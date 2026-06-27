# HarnessKit

> **一行代码接入 AI Harness 聊天** — 从 [SkillChat](https://github.com/cnwinds/skill-chat) 提炼的可复用聊天 Harness 库。

HarnessKit 将 Turn 调度、SSE 流式协议、LLM Agent Loop 与 React 客户端拆成独立 npm 包，让任意项目快速获得与 SkillChat 同级的 Harness 聊天能力。

## 包结构

| 包 | 说明 |
|---|---|
| `@harnesskit/protocol` | 跨端类型、Zod Schema、SSE 事件契约 |
| `@harnesskit/core` | Turn 运行时、StreamHub、可插拔持久化 |
| `@harnesskit/harness` | LLM Harness 引擎（OpenAI Responses）与 Tool 调度 |
| `@harnesskit/server` | Fastify 适配器，`createHarnessChat()` 一行挂载 |
| `@harnesskit/react` | React Hooks + 可选 UI 组件 |

## 一行接入

### 后端

```typescript
import Fastify from 'fastify';
import { createHarnessChat } from '@harnesskit/server';

const app = Fastify();
const chat = createHarnessChat({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
});

await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000 });
```

### 前端

```tsx
import { HarnessChat } from '@harnesskit/react';

export function ChatPage() {
  return (
    <HarnessChat
      apiBase="/api/chat"
      credentials="include"
    />
  );
}
```

Headless 模式：

```tsx
import { HarnessChatProvider, useHarnessChat } from '@harnesskit/react';

function MyComposer() {
  const { send, interrupt, runtime, streamingText } = useHarnessChat();
  // 完全自定义 UI
}
```

## 设计文档

- [总体设计](./docs/DESIGN.md)
- [架构分层](./docs/ARCHITECTURE.md)
- [接入指南](./docs/INTEGRATION.md)
- [从 SkillChat 迁移](./docs/MIGRATION.md)

## 开发

```bash
npm install
npm run build
npm run typecheck
```

## 与 SkillChat 的关系

```
SkillChat (应用)          HarnessKit (库)
├── Auth / Admin     →    (应用层保留)
├── Skill Market     →    (通过 SkillCatalogProvider 插件)
├── Chat UI          →    @harnesskit/react
└── Turn + Harness   →    @harnesskit/core + harness + server
```

## License

MIT
