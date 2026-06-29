# HarnessKit Demo

可运行的全栈对接参考：Fastify 后端 + React 前端，展示 README 里「一行接入」的实际用法。

文档入口：[快速开始](../../docs/QUICKSTART.md) · [API 参考](../../docs/API.md) · [接入指南](../../docs/INTEGRATION.md) · [进阶配置](../../docs/ADVANCED.md)

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

Headless 模式用 `useHarnessChat()` 完全自定义 UI，见 [INTEGRATION.md — Headless](../../docs/INTEGRATION.md#headless-模式)。

## API 契约（React 客户端依赖）

完整说明见 [docs/API.md](../../docs/API.md)。

| 方法 | 路径 | 响应 |
|------|------|------|
| POST | `/sessions` | `{ session }` |
| GET | `/sessions` | `{ sessions }` |
| GET | `/sessions/:id/messages` | `{ events }` |
| POST | `/sessions/:id/messages` | `MessageDispatchResponse` |
| GET | `/sessions/:id/runtime` | `{ runtime }` |
| GET | `/sessions/:id/stream` | SSE |

## 进阶能力配置（联网搜索 / 生图）

HarnessKit 支持在聊天模型之外独立配置 **联网搜索** 与 **图片生成**。Demo 通过 `examples/minimal-server/.env` 注入，SkillChat 可在管理后台 **设置 → 系统** 中在线修改。

| 能力 | 关键变量 | 说明 |
|------|----------|------|
| 联网搜索 | `WEB_SEARCH_MODE` | `live` / `cached` / `disabled` |
| | `OPENAI_NATIVE_WEB_SEARCH` | `auto` / `on` / `off`；Native 复用 `OPENAI_API_KEY` |
| | `TAVILY_API_KEY` 等 | 三方 Provider，有 Key 即激活 |
| | `WEB_SEARCH_PROVIDERS` | 可选优先级，如 `openai_native,tavily,serper,brave` |
| 图片生成 | `OPENAI_NATIVE_IMAGE_GENERATION` | Native 走 Responses 内置 `image_generation` |
| | `OPENAI_IMAGE_*` / `ZHIPU_IMAGE_*` / `DASHSCOPE_IMAGE_*` | 三方生图通道 |
| | `IMAGE_PROVIDERS` | 可选优先级，如 `openai_images,zhipu,bailian` |

**推荐起步：**

1. 仅官方 OpenAI：保持 Native `auto`，填写 `OPENAI_API_KEY` 指向 `api.openai.com`。
2. 中转站聊天 + 官方生图：`OPENAI_NATIVE_IMAGE_GENERATION=off`，另填 `OPENAI_IMAGE_API_KEY` 直连生图 API。
3. 国内模型：聊天走 DashScope 兼容端点，生图填 `DASHSCOPE_IMAGE_API_KEY` + `wan2.1-t2i-turbo`。

完整说明见 [ADVANCED.md](../../docs/ADVANCED.md)。SkillChat 部署后可在管理后台折叠面板中逐项配置，无需重启。

## 本地数据

默认写入 `examples/minimal-server/data/`（可通过 `HARNESSKIT_DATA_ROOT` 覆盖）。

## 常见问题

**没有 API Key 能启动吗？**  
可以启动并创建会话；发送消息时 Harness 会报错，可在 UI 中看到 error 事件。

**生产部署**  
将 Vite 构建产物与 Fastify 同域部署，或配置 CORS + 正确的 `apiBase`。
