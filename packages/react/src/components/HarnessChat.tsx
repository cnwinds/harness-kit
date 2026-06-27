import { useHarnessChat } from '../hooks/use-harness-chat.js';

export type HarnessChatProps = {
  className?: string;
};

/**
 * Drop-in chat UI — minimal MVP component.
 * Phase 3: migrate full SkillChat chat components with Tailwind styling.
 */
export const HarnessChat = ({ className }: HarnessChatProps) => {
  const { messages, streamingText, send, interrupt, streamStatus, runtime } = useHarnessChat();
  const active = runtime?.activeTurn;

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'system-ui' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.map((e) =>
          e.kind === 'message' ? (
            <div key={e.id} style={{ marginBottom: 12 }}>
              <strong>{e.role}: </strong>
              {e.content}
            </div>
          ) : null,
        )}
        {streamingText && (
          <div style={{ marginBottom: 12, opacity: 0.8 }}>
            <strong>assistant: </strong>
            {streamingText}
          </div>
        )}
      </div>
      <form
        style={{ display: 'flex', gap: 8, padding: 16, borderTop: '1px solid #eee' }}
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          const content = String(fd.get('content') ?? '').trim();
          if (content) void send(content);
          ev.currentTarget.reset();
        }}
      >
        <input name="content" placeholder="输入消息…" style={{ flex: 1, padding: 8 }} />
        <button type="submit">发送</button>
        {active && (
          <button type="button" onClick={() => void interrupt()}>
            停止
          </button>
        )}
      </form>
      <div style={{ padding: '4px 16px', fontSize: 12, color: '#888' }}>
        {streamStatus}
        {active ? ` · turn ${active.turnId.slice(0, 8)}` : ''}
      </div>
    </div>
  );
};
