# HarnessKit 架构分层

## 包职责矩阵

| 模块 | 包 | 来源 (SkillChat) | 框架依赖 |
|---|---|---|---|
| SSE 事件名 + Payload 类型 | protocol | `packages/shared` | 无 |
| Zod 请求/响应 Schema | protocol | `packages/shared/schemas` | zod |
| Turn 状态机 | core | `core/turn/*` | 无 |
| StreamHub pub/sub | core | `core/stream/stream-hub` | 无 |
| JSONL MessageStore | core | `core/storage/message-store` | 无 |
| OpenAI Responses 解析 | harness | `core/llm/openai-responses` | 无 |
| Agent Loop + Tools | harness | `modules/chat/openai-harness` | 无 |
| Fastify 路由装配 | server | `apps/server/app.ts` (chat 段) | fastify |
| SSE 客户端 Hook | react | `hooks/useSessionStream` | react |
| 流式 Zustand Store | react | `stores/ui-store` (streams 段) | zustand |
| Timeline 渲染辅助 | react | `lib/timeline` | 无 |
| Chat UI 组件 | react | `components/chat/*` | react + tailwind |

## 依赖注入边界

SkillChat 的 `ChatService` 是最大耦合点 — 拆库时拆为：

```
ChatOrchestrator (@skillchat/harness-server 内部)
├── TurnRuntime          ← @skillchat/harness-core
├── HarnessEngine        ← @skillchat/harness
├── MessageStore         ← PersistenceBundle.messages
├── SessionStore         ← PersistenceBundle.sessions
├── FileContextProvider  ← adapter
├── SkillCatalogProvider ← adapter
├── ScriptExecutor       ← adapter
├── StreamHub.publish    ← @skillchat/harness-core
└── AuthResolver         ← adapter
```

## 扩展点

### 自定义 Tool

```typescript
import { defineTool, createHarnessChat } from '@skillchat/harness-server';

const chat = createHarnessChat({
  llm: { apiKey: '...' },
  tools: (registry) => {
    registry.add(defineTool({
      name: 'get_weather',
      description: 'Get weather for a city',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temp: 22, city }),
    }));
  },
});
```

### 自定义 Harness Provider

```typescript
import { createHarnessEngine, type HarnessProvider } from '@skillchat/harness';

const anthropicProvider: HarnessProvider = {
  name: 'anthropic',
  stream: async (ctx, signal) => { /* ... */ },
};

const engine = createHarnessEngine({ provider: anthropicProvider });
```

### 替换持久化

```typescript
createHarnessChat({
  llm: { apiKey: '...' },
  persistence: {
    messages: new PostgresMessageStore(pool),
    runtime: new RedisRuntimePersistence(redis),
    context: new PostgresContextStore(pool),
    sessions: new PostgresSessionStore(pool),
  },
});
```

## 前端状态双轨

与 SkillChat 一致：

1. **TanStack Query** — sessions、messages、runtime（服务端权威）
2. **Zustand (streams)** — pendingText、transientEvents、activeTurn（SSE 瞬态）

重连 reconciliation：

```
SSE reconnect → refetch messages + runtime → merge into timeline
```

## 目录结构

```
harness-kit/
├── packages/
│   ├── protocol/src/
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   ├── schemas.ts
│   │   └── index.ts
│   ├── core/src/
│   │   ├── turn/
│   │   ├── stream/
│   │   ├── storage/
│   │   ├── adapters.ts      # 插件接口
│   │   └── index.ts
│   ├── harness/src/
│   │   ├── engine.ts
│   │   ├── openai-provider.ts
│   │   ├── tools/
│   │   └── index.ts
│   ├── server/src/
│   │   ├── create-harness-chat.ts
│   │   ├── routes/
│   │   ├── orchestrator.ts
│   │   └── index.ts
│   └── react/src/
│       ├── provider.tsx
│       ├── hooks/
│       ├── store/
│       ├── components/
│       └── index.ts
├── examples/
│   ├── minimal-server/
│   └── minimal-react/
└── docs/
```
