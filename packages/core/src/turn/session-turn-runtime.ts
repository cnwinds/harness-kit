import { randomUUID } from 'node:crypto';
import type {
  MessageDispatchResponse,
  MessageDispatchResult,
  SessionRuntimeSnapshot,
  TurnPhase,
  TurnStatus,
} from '@harnesskit/protocol';
import type {
  CreateTurnRuntimeOptions,
  PersistedRuntimeState,
  RuntimeInput,
  TurnDispatchArgs,
  TurnDispatchResult,
  TurnRuntime,
} from '../adapters.js';
import type { TurnExecutionContext } from '../adapters.js';

/**
 * Session-scoped turn scheduler with steering, queue, and interrupt semantics.
 *
 * Phase 2 will migrate full implementation from SkillChat SessionTurnRuntime.
 * This skeleton validates the public API surface and snapshot shape.
 */
export class SessionTurnRuntime implements TurnRuntime {
  private readonly sessionId: string;
  private readonly callbacks: CreateTurnRuntimeOptions['callbacks'];
  private activeTurn: ActiveTurnState | null = null;
  private followUpQueue: RuntimeInput[] = [];
  private recovery: SessionRuntimeSnapshot['recovery'] = null;

  constructor(options: CreateTurnRuntimeOptions) {
    this.sessionId = options.sessionId;
    this.callbacks = options.callbacks;
  }

  async dispatchMessage(args: TurnDispatchArgs): Promise<TurnDispatchResult> {
    const inputId = randomUUID();
    const messageId = randomUUID();
    const runId = randomUUID();
    const mode = args.mode ?? 'auto';
    const input: RuntimeInput = {
      inputId,
      content: args.content,
      createdAt: new Date().toISOString(),
      source: 'direct',
      requestedKind: args.kind ?? 'regular',
      attachmentIds: args.attachmentIds,
      turnConfig: args.turnConfig,
    };

    let dispatch: MessageDispatchResult;
    let turnId: string | undefined;

    if (this.activeTurn && mode === 'steer' && this.activeTurn.canSteer) {
      this.activeTurn.pendingInputs.push({ ...input, source: 'steer' });
      dispatch = 'steer_accepted';
      turnId = this.activeTurn.turnId;
    } else if (this.activeTurn && mode === 'auto' && this.activeTurn.canSteer) {
      this.activeTurn.pendingInputs.push({ ...input, source: 'steer' });
      dispatch = 'steer_accepted';
      turnId = this.activeTurn.turnId;
    } else if (this.activeTurn && (mode === 'queue_next' || mode === 'auto')) {
      this.followUpQueue.push({ ...input, source: 'queued' });
      dispatch = 'queued';
    } else {
      turnId = randomUUID();
      dispatch = 'turn_started';
      this.startTurn(args, turnId!, input);
    }

    const response: MessageDispatchResponse = {
      accepted: true,
      dispatch,
      messageId,
      runId,
      turnId,
      inputId,
      runtime: this.getSnapshot(),
    };

    return { response, task: this.activeTurn?.task };
  }

  async steer(args: {
    user: TurnDispatchArgs['user'];
    turnId: string;
    content: string;
    attachmentIds?: string[];
  }): Promise<TurnDispatchResult> {
    return this.dispatchMessage({
      user: args.user,
      sessionId: this.sessionId,
      content: args.content,
      attachmentIds: args.attachmentIds,
      mode: 'steer',
      turnId: args.turnId,
    });
  }

  async interrupt(args: { user: TurnDispatchArgs['user']; turnId: string }): Promise<SessionRuntimeSnapshot> {
    if (this.activeTurn?.turnId === args.turnId) {
      this.activeTurn.status = 'interrupting';
      this.activeTurn.controller.abort();
    }
    return this.getSnapshot();
  }

  async removeQueuedInput(args: { user: TurnDispatchArgs['user']; inputId: string }): Promise<SessionRuntimeSnapshot> {
    this.followUpQueue = this.followUpQueue.filter((i) => i.inputId !== args.inputId);
    return this.getSnapshot();
  }

  getSnapshot(): SessionRuntimeSnapshot {
    return {
      sessionId: this.sessionId,
      activeTurn: this.activeTurn
        ? {
            turnId: this.activeTurn.turnId,
            kind: this.activeTurn.kind,
            status: this.activeTurn.status,
            phase: this.activeTurn.phase,
            phaseStartedAt: this.activeTurn.phaseStartedAt,
            canSteer: this.activeTurn.canSteer,
            startedAt: this.activeTurn.startedAt,
            round: this.activeTurn.round,
          }
        : null,
      followUpQueue: this.followUpQueue.map((i) => ({
        inputId: i.inputId,
        content: i.content,
        createdAt: i.createdAt,
      })),
      recovery: this.recovery,
    };
  }

  async recover(state: PersistedRuntimeState): Promise<void> {
    this.followUpQueue = state.followUpQueue;
    this.recovery = state.recovery;
    // Full recovery of in-flight turns deferred to Phase 2 migration
  }

  private startTurn(args: TurnDispatchArgs, turnId: string, input: RuntimeInput): void {
    const controller = new AbortController();
    const ctx = {
      user: args.user,
      sessionId: this.sessionId,
      turnId,
      kind: input.requestedKind,
      initialInput: input,
      signal: controller.signal,
      updatePhase: (phase: TurnPhase) => {
        if (this.activeTurn) this.activeTurn.phase = phase;
      },
      setCanSteer: (canSteer: boolean) => {
        if (this.activeTurn) this.activeTurn.canSteer = canSteer;
      },
      setRound: (round: number) => {
        if (this.activeTurn) this.activeTurn.round = round;
      },
      drainPendingInputs: async () => {
        if (!this.activeTurn) return [];
        const pending = [...this.activeTurn.pendingInputs];
        this.activeTurn.pendingInputs = [];
        return pending;
      },
      isAborted: () => controller.signal.aborted,
      throwIfAborted: () => {
        if (controller.signal.aborted) throw new Error('Turn aborted');
      },
    };

    this.activeTurn = {
      turnId,
      kind: input.requestedKind,
      status: 'running',
      phase: 'sampling',
      phaseStartedAt: new Date().toISOString(),
      canSteer: false,
      startedAt: new Date().toISOString(),
      round: 0,
      pendingInputs: [],
      controller,
      task: this.runTurn(ctx, input),
    };
  }

  private async runTurn(ctx: TurnExecutionContext, input: RuntimeInput): Promise<void> {
    try {
      await this.callbacks.onInputCommitted({
        user: ctx.user,
        sessionId: this.sessionId,
        turnId: ctx.turnId,
        kind: ctx.kind,
        input,
      });
      await this.callbacks.onExecuteTurn(ctx);
    } catch (error) {
      await this.callbacks.onTurnFailure({
        user: ctx.user,
        sessionId: this.sessionId,
        turnId: ctx.turnId,
        error,
      });
    } finally {
      const active = this.activeTurn;
      if (active?.turnId === ctx.turnId) {
        active.status = controllerStatus(ctx.signal);
        this.activeTurn = null;
        this.drainFollowUpQueue(ctx.user);
      }
    }
  }

  private drainFollowUpQueue(user: TurnDispatchArgs['user']): void {
    const next = this.followUpQueue.shift();
    if (!next || this.activeTurn) return;
    void this.dispatchMessage({
      user,
      sessionId: this.sessionId,
      content: next.content,
      attachmentIds: next.attachmentIds,
      mode: 'new_turn',
      kind: next.requestedKind,
      turnConfig: next.turnConfig,
    });
  }
}

type ActiveTurnState = {
  turnId: string;
  kind: RuntimeInput['requestedKind'];
  status: TurnStatus;
  phase: TurnPhase;
  phaseStartedAt: string;
  canSteer: boolean;
  startedAt: string;
  round: number;
  pendingInputs: RuntimeInput[];
  controller: AbortController;
  task?: Promise<void>;
};

const controllerStatus = (signal: AbortSignal): TurnStatus =>
  signal.aborted ? 'interrupted' : 'completed';

export const createTurnRuntime = (options: CreateTurnRuntimeOptions): TurnRuntime =>
  new SessionTurnRuntime(options);
