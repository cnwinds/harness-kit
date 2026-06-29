# HarnessKit 接入指南

> 首次接入？请先阅读 [快速开始](./QUICKSTART.md)。REST / SSE 契约见 [API 参考](./API.md)。联网搜索、生图与环境变量见 [进阶配置](./ADVANCED.md)。

## 目录

- [认证集成](#认证集成)
- [Skill 集成](#skill-集成)
- [消息调度模式](#消息调度模式)
- [Headless 模式](#headless-模式)
- [会话管理](#会话管理)
- [SSE 事件处理（自定义客户端）](#sse-事件处理自定义客户端)
- [底层 API：createHarnessChat](#底层-apicreateharnesschat)

---

## 认证集成

默认 `AnonymousAuthResolver`（单用户 demo）。生产环境：

```typescript
import type { AuthResolver } from '@skillchat/harness-server';

const jwtAuth: AuthResolver = {
  async resolve(request) {
    const token = parseCookie(request, 'session');
    if (!token) return null;
    const payload = await verifyJwt(token);
    return { id: payload.sub, username: payload.name, role: 'member' };
  },
};

createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  auth: jwtAuth,
});
```

前端需 `credentials: 'include'` 或 Bearer token 头（通过 `fetchOptions` 配置）。

---

## Skill 集成

```typescript
import type { SkillCatalogProvider } from '@skillchat/harness-core';

const mySkills: SkillCatalogProvider = {
  async listAvailable(userId) {
    return [{ id: 'my/pdf', name: 'PDF', description: '...' }];
  },
  async resolveInstructions(sessionId, skillIds) {
    return skillIds.map((id) => readSkillMd(id)).join('\n\n');
  },
};

createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  skills: mySkills,
});
```

---

## 消息调度模式

```typescript
await chat.send('继续优化', { mode: 'steer' });      // Mid-turn 引导
await chat.send('新话题', { mode: 'new_turn' });     // 强制新 turn
await chat.send('稍后处理', { mode: 'queue_next' }); // 排队
await chat.send('自动', { mode: 'auto' });           // 默认：能 steer 则 steer，否则 queue
```

---

## Headless 模式

不使用 `<HarnessChat />`，由应用完全自定义 UI：

```tsx
import { useState } from 'react';
import { HarnessChatProvider, useHarnessChat, MessageItem, Composer } from '@skillchat/harness-react';
import '@skillchat/harness-react/theme.css';

export function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <HarnessChatProvider apiBase="/api/chat" credentials="include">
      <ChatPage sessionId={sessionId} onSessionChange={setSessionId} />
    </HarnessChatProvider>
  );
}

function ChatPage({
  sessionId,
  onSessionChange,
}: {
  sessionId: string | null;
  onSessionChange: (id: string) => void;
}) {
  const chat = useHarnessChat({ sessionId });

  return (
    <div>
      {chat.messages.map((event) =>
        event.kind === 'message' ? <MessageItem key={event.id} event={event} /> : null,
      )}
      {chat.streamingText ? <p>{chat.streamingText}</p> : null}
      <Composer
        onSend={(content) => void chat.send(content)}
        disabled={chat.streamStatus === 'connecting'}
      />
      <button type="button" onClick={() => void chat.interrupt()} disabled={!chat.runtime?.activeTurn}>
        停止
      </button>
    </div>
  );
}
```

---

## 会话管理

| 层级 | 能力 |
|------|------|
| **服务端**（Bootstrap） | 自动挂载 `GET/POST /sessions` 路由 |
| **`<HarnessChat />`** | 首条消息时自动 `POST /sessions`，无需传 `sessionId` |
| **Headless `useHarnessChat`** | 需应用传入 `sessionId`；会话列表 UI 由应用自建 |
| **React Hook** | 无 `useHarnessSessions`；可用 TanStack Query 直接调 REST |

若 Headless 模式下 `useHarnessChat.send()` 在未传入 `sessionId` 时需要自动建会话，应用需自行实现 `POST {apiBase}/sessions` 逻辑（`<HarnessChat />` 已内置）。

---

## SSE 事件处理（自定义客户端）

若不使用 `@skillchat/harness-react`，可直接消费 SSE：

```typescript
import { type SSEEventName } from '@skillchat/harness-protocol';
import { fetchEventSource } from '@microsoft/fetch-event-source';

await fetchEventSource(`/api/chat/sessions/${sessionId}/stream`, {
  credentials: 'include',
  onmessage(ev) {
    const event = ev.event as SSEEventName;
    const data = JSON.parse(ev.data);
    // handle text_delta, turn_completed, done, ...
  },
});
```

重连后务必 REST 对账：

```typescript
const [messages, runtime] = await Promise.all([
  fetch(`/api/chat/sessions/${id}/messages`).then((r) => r.json()),
  fetch(`/api/chat/sessions/${id}/runtime`).then((r) => r.json()),
]);
```

SSE 事件类型与 payload 见 [API 参考 — SSE 事件](./API.md#sse-事件)。

---

## 底层 API：createHarnessChat

已有完整依赖注入（自定义 MessageStore、Orchestrator 等）时使用：

```typescript
import { createHarnessChat } from '@skillchat/harness-server';

const chat = createHarnessChat({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
  auth: jwtAuth,
  skills: mySkills,
  // persistence, tools, files, scripts ...
});

await chat.mount(app, { prefix: '/api/chat' });
```

`createHarnessChatBootstrap` 是对 `createHarnessChat` 的便捷封装，自动创建默认 MessageStore、SessionStore、StreamHub 等组件。大多数项目从 Bootstrap 开始即可。

---

## 示例项目

```bash
cd harness-kit
npm install && npm run build
npm run dev:minimal-server   # :3000
npm run dev:minimal-react    # :5173
# 或一键全栈：
npm run dev:demo
```

- [examples/demo/README.md](../examples/demo/README.md) — 全栈 demo
- [examples/minimal-server/README.md](../examples/minimal-server/README.md) — 后端示例
- [examples/minimal-react/README.md](../examples/minimal-react/README.md) — 前端示例
