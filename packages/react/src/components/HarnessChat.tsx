import { useHarnessChat } from '../hooks/use-harness-chat.js';

export type HarnessChatProps = {
  className?: string;
};

/**
 * Drop-in chat UI — uses --hk-* CSS tokens from HarnessChatProvider theme.
 */
export const HarnessChat = ({ className }: HarnessChatProps) => {
  const { messages, streamingText, send, interrupt, streamStatus, runtime } = useHarnessChat();
  const active = runtime?.activeTurn;

  return (
    <div className={['hk-chat', className].filter(Boolean).join(' ')}>
      <div className="hk-chat__messages">
        {messages.map((e) =>
          e.kind === 'message' ? (
            <div
              key={e.id}
              className={`hk-chat__message hk-chat__message--${e.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="hk-chat__role">{e.role}</div>
              {e.content}
            </div>
          ) : null,
        )}
        {streamingText && (
          <div className="hk-chat__message hk-chat__message--assistant hk-chat__message--streaming">
            <div className="hk-chat__role">assistant</div>
            {streamingText}
          </div>
        )}
      </div>
      <form
        className="hk-chat__composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          const content = String(fd.get('content') ?? '').trim();
          if (content) void send(content);
          ev.currentTarget.reset();
        }}
      >
        <input className="hk-chat__input" name="content" placeholder="输入消息…" />
        <button className="hk-chat__btn hk-chat__btn--primary" type="submit">
          发送
        </button>
        {active && (
          <button className="hk-chat__btn hk-chat__btn--danger" type="button" onClick={() => void interrupt()}>
            停止
          </button>
        )}
      </form>
      <div className="hk-chat__status">
        {streamStatus}
        {active ? ` · turn ${active.turnId.slice(0, 8)}` : ''}
      </div>
    </div>
  );
};
