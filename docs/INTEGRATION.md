# HarnessKit 接入指南

## 快速开始

### 1. 安装

```bash
npm install @harnesskit/server @harnesskit/react @harnesskit/protocol
```

### 2. 后端（Fastify）

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHarnessChat } from '@harnesskit/server';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const chat = createHarnessChat({
  llm: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
  },
  dataRoot: './data',
});

await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000, host: '0.0.0.0' });
```

### 3. 前端（React + Vite）

```tsx
// main.tsx
import { HarnessChatProvider } from '@harnesskit/react';

root.render(
  <HarnessChatProvider apiBase="/api/chat" credentials="include">
    <App />
  </HarnessChatProvider>,
);
```

```tsx
// ChatPage.tsx — 方式 A：开箱即用
import { HarnessChat } from '@harnesskit/react';

export function ChatPage() {
  return <HarnessChat />;
}
```

```tsx
// ChatPage.tsx — 方式 B：Headless（应用自管 sessionId + 自定义 UI）
import { useState } from 'react';
import { useHarnessChat, MessageItem, Composer } from '@harnesskit/react';

export function ChatPage() {
  // 会话列表/创建由应用层负责（例如 SkillChat 的 /api/sessions）。
  // 传入 sessionId 后，useHarnessChat 会拉取 messages/runtime 并订阅 SSE。
  const [sessionId, setSessionId] = useState<string | null>(null);
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

> **说明：** HarnessKit 不提供 `useHarnessSessions`。会话 CRUD 属于应用层；`createHarnessChat()` 挂载的是消息、runtime、SSE 等 Harness 路由。若 `useHarnessChat.send()` 在未传入 `sessionId` 时自动建会话，需应用额外提供 `POST {apiBase}/sessions`。

### 4. Vite 代理

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/chat': 'http://localhost:3000',
    },
  },
});
```

---

## 认证集成

默认 `AnonymousAuthResolver`（单用户 demo）。生产环境：

```typescript
import type { AuthResolver, ChatUser } from '@harnesskit/server';

const jwtAuth: AuthResolver = {
  async resolve(request) {
    const token = parseCookie(request, 'session');
    if (!token) return null;
    const payload = await verifyJwt(token);
    return { id: payload.sub, username: payload.name, role: 'member' };
  },
};

createHarnessChat({
  llm: { apiKey: '...' },
  auth: jwtAuth,
});
```

前端需 `credentials: 'include'` 或 Bearer token 头（通过 `fetchOptions` 配置）。

---

## Skill 集成

```typescript
import type { SkillCatalogProvider } from '@harnesskit/core';

const mySkills: SkillCatalogProvider = {
  async listAvailable(userId) {
    return [{ id: 'my/pdf', name: 'PDF', description: '...' }];
  },
  async resolveInstructions(sessionId, skillIds) {
    return skillIds.map((id) => readSkillMd(id)).join('\n\n');
  },
};

createHarnessChat({
  llm: { apiKey: '...' },
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

## SSE 事件处理（自定义客户端）

若不使用 `@harnesskit/react`，可直接消费 SSE：

```typescript
import { SSE_EVENT_NAMES, type SSEEventName } from '@harnesskit/protocol';
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

重连后务必：

```typescript
const [messages, runtime] = await Promise.all([
  fetch(`/api/chat/sessions/${id}/messages`).then((r) => r.json()),
  fetch(`/api/chat/sessions/${id}/runtime`).then((r) => r.json()),
]);
```

---

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | — | LLM API Key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 兼容端点 |
| `OPENAI_MODEL` | `gpt-4.1` | 默认模型 |
| `HARNESSKIT_DATA_ROOT` | `./data` | 数据目录 |
| `HARNESSKIT_INLINE_JOBS` | `false` | 同步等待 turn 完成 |

---

## 示例项目

```bash
cd harness-kit
npm install
npm run dev:minimal-server   # :3000
npm run dev:minimal-react    # :5173
```

见 `examples/minimal-server` 与 `examples/minimal-react`。
