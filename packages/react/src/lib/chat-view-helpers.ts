import type { ThinkingEvent } from '@skillchat/harness-protocol';
import type { TimelineItem } from './timeline.js';
import type { SessionStreamState } from '../store/stream-ui-store.js';

export const buildRuntimeThinkingEvent = (args: {
  sessionId: string;
  phase: string | null;
  phaseStartedAt: string | null;
  round: number | null;
}): ThinkingEvent | undefined => {
  if (!args.phaseStartedAt) {
    return undefined;
  }

  let content: string | null = null;
  if (args.phase === 'sampling') {
    content = args.round && args.round > 1 ? '继续处理追加引导' : '正在分析需求';
  } else if (args.phase === 'tool_call') {
    content = '正在调用工具';
  } else if (args.phase === 'waiting_tool_result') {
    content = '等待工具结果';
  } else if (args.phase === 'finalizing') {
    content = '正在整理最终回复';
  }

  if (!content) {
    return undefined;
  }

  return {
    id: `runtime-thinking-${args.sessionId}`,
    sessionId: args.sessionId,
    kind: 'thinking',
    content,
    createdAt: args.phaseStartedAt,
  };
};

export const resolveThinkingEvent = (
  sessionId: string | null,
  stream: SessionStreamState,
  activeThinking?: ThinkingEvent,
): ThinkingEvent | undefined => {
  if (
    sessionId &&
    stream.status === 'reconnecting' &&
    stream.reconnectAttempt &&
    stream.reconnectLimit &&
    (stream.activeTurnId || activeThinking || stream.activeTurnPhaseStartedAt)
  ) {
    return {
      id: `runtime-reconnecting-${sessionId}`,
      sessionId,
      kind: 'thinking',
      content: `重连中 ${stream.reconnectAttempt}/${stream.reconnectLimit}`,
      createdAt: activeThinking?.createdAt ?? stream.activeTurnPhaseStartedAt ?? new Date().toISOString(),
    };
  }

  return (
    activeThinking ??
    (sessionId
      ? buildRuntimeThinkingEvent({
          sessionId,
          phase: stream.activeTurnPhase,
          phaseStartedAt: stream.activeTurnPhaseStartedAt,
          round: stream.activeTurnRound,
        })
      : undefined)
  );
};

export const shouldRenderPendingText = (pendingText: string, timeline: TimelineItem[]) => {
  if (!pendingText) {
    return false;
  }

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const item = timeline[index];
    if (item?.kind === 'message' && item.role === 'assistant') {
      return item.content !== pendingText;
    }
  }

  return true;
};

export const isTurnRunning = (stream: SessionStreamState) => (
  Boolean(stream.activeTurnId) &&
  (stream.activeTurnStatus === 'running' || stream.activeTurnStatus === 'interrupting')
);

const STREAM_STATUS_LABELS: Record<SessionStreamState['status'], string> = {
  idle: '待命',
  connecting: '连接中…',
  open: '已连接',
  reconnecting: '重连中…',
  error: '连接异常',
};

const PHASE_LABELS: Record<string, string> = {
  sampling: '模型推理',
  tool_call: '调用工具',
  waiting_tool_result: '等待工具',
  finalizing: '整理回复',
};

export const formatStreamStatusLine = (stream: SessionStreamState) => {
  const parts: string[] = [STREAM_STATUS_LABELS[stream.status] ?? stream.status];

  if (stream.status === 'error' && stream.lastError) {
    parts.push(stream.lastError);
  }

  if (isTurnRunning(stream)) {
    if (stream.activeTurnPhase) {
      parts.push(PHASE_LABELS[stream.activeTurnPhase] ?? stream.activeTurnPhase);
    }
    if (stream.activeTurnRound) {
      parts.push(`第 ${stream.activeTurnRound} 轮`);
    }
  }

  return parts.join(' · ');
};
