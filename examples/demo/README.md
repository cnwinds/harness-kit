# HarnessKit Demo

可运行的全栈对接参考：Fastify 后端 + React 前端，展示 README 里「一行接入」的实际用法。

## 前置条件

- Node.js >= 22
- 仓库根目录已执行 `npm install` 与 `npm run build`
- 在 `examples/minimal-server/.env` 中配置 LLM（见 `.env.example`）

## 快速启动

在仓库根目录：

```bash
npm run build
cp examples/minimal-server/.env.example examples/minimal-server/.env
# 编辑 .env，填入 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL
npm run dev:demo
```

`.env` 会**覆盖**系统环境变量里的 `OPENAI_*`，避免误连其他代理（如 Codex）。

- 后端：`http://localhost:3000/api/chat`
- 前端：`http://localhost:5173`（Vite 已将 `/api/chat` 代理到 3000）

## 目录结构

```
examples/
├── demo/              ← 本说明 + 一键启动脚本
├── minimal-server/    ← Fastify + createHarnessChatBootstrap
└── minimal-react/     ← React + HarnessChatProvider + HarnessChat
```

## 后端对接（5 行核心代码）

```typescript
import Fastify from 'fastify';
import { createHarnessChatBootstrap } from '@harnesskit/server';

const app = Fastify();
const chat = createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
});
await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000 });
```

`createHarnessChatBootstrap` 会自动装配：

| 组件 | 说明 |
|------|------|
| `MessageStore` | 消息持久化（`dataRoot` 下） |
| `StreamHub` | SSE 广播 |
| `LocalSessionStore` | `GET/POST /sessions` |
| `LocalFileService` | 附件占位实现 |
| `ChatOrchestrator` | Turn 调度 + OpenAI Harness |

已有完整依赖注入时，可直接使用底层 `createHarnessChat({ config, messageStore, ... })`。

## 前端对接

```tsx
import { HarnessChatProvider, HarnessChat } from '@harnesskit/react';
import '@harnesskit/react/theme.css';

export function App() {
  return (
    <HarnessChatProvider apiBase="/api/chat">
      <HarnessChat />
    </HarnessChatProvider>
  );
}
```

Headless 模式用 `useHarnessChat()` 完全自定义 UI，见 [INTEGRATION.md](../../docs/INTEGRATION.md)。

## API 契约（React 客户端依赖）

| 方法 | 路径 | 响应 |
|------|------|------|
| POST | `/sessions` | `{ session }` |
| GET | `/sessions` | `{ sessions }` |
| GET | `/sessions/:id/messages` | `{ events }` |
| POST | `/sessions/:id/messages` | `MessageDispatchResponse` |
| GET | `/sessions/:id/runtime` | `{ runtime }` |
| GET | `/sessions/:id/stream` | SSE |

## 本地数据

默认写入 `examples/minimal-server/data/`（可通过 `HARNESSKIT_DATA_ROOT` 覆盖）。

## 常见问题

**没有 API Key 能启动吗？**  
可以启动并创建会话；发送消息时 Harness 会报错，可在 UI 中看到 error 事件。

**生产部署**  
将 Vite 构建产物与 Fastify 同域部署，或配置 CORS + 正确的 `apiBase`。
