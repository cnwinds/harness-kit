# 快速开始

5 分钟内跑通 HarnessKit 全栈聊天。API 契约见 [API.md](./API.md)，进阶配置见 [ADVANCED.md](./ADVANCED.md)，认证 / Skill / Headless 见 [INTEGRATION.md](./INTEGRATION.md)。

## 前置条件

- **Node.js** >= 22
- **React** 18+ 项目（推荐 Vite）
- 可用的 LLM API Key（OpenAI 或兼容端点）

## 安装

`@skillchat/harness-*` 当前为 monorepo 内部包，发布到 `@skillchat` npm 组织。在独立项目中通过 `file:` 引用：

```json
{
  "dependencies": {
    "@skillchat/harness-server": "file:../harness-kit/packages/server",
    "@skillchat/harness-react": "file:../harness-kit/packages/react",
    "@skillchat/harness-protocol": "file:../harness-kit/packages/protocol"
  }
}
```

引用后先在 harness-kit 仓库执行 `npm run build`，再在你的项目执行 `npm install`。

> 若已发布到 npm，可直接 `npm install @skillchat/harness-server @skillchat/harness-react @skillchat/harness-protocol`。

## 选哪个 API？

| API | 适用场景 |
|-----|----------|
| **`createHarnessChatBootstrap`** | MVP / 快速接入。自动装配 MessageStore、SessionStore、StreamHub、文件服务等 |
| **`createHarnessChat`** | 已有完整依赖注入，需自定义 MessageStore、Auth、Tool 等 |

下文示例均使用 **Bootstrap**。

---

## 后端（Fastify）

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHarnessChatBootstrap } from '@skillchat/harness-server';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const chat = createHarnessChatBootstrap({
  llm: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL ?? 'gpt-5.4',
  },
  dataRoot: './data',
});

await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000, host: '0.0.0.0' });
```

Bootstrap 挂载后自动注册：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET / POST | `/sessions` | 会话列表 / 创建 |
| GET | `/sessions/:id/messages` | 历史事件 |
| POST | `/sessions/:id/messages` | 发送消息 |
| GET | `/sessions/:id/runtime` | 运行态快照 |
| GET | `/sessions/:id/stream` | SSE 长连接 |
| POST | `/sessions/:id/turns/:turnId/interrupt` | 中断 |
| POST | `/sessions/:id/turns/:turnId/steer` | Mid-turn 引导 |

---

## 前端（React）

### 1. 安装运行时依赖

使用 `<HarnessChat />` 开箱即用 UI 时，除 `@skillchat/harness-react` 外还需：

```bash
npm install @tanstack/react-query lucide-react react-markdown remark-gfm
npm install -D tailwindcss @tailwindcss/typography postcss autoprefixer
```

`HarnessChatProvider` 内部已包含 `QueryClientProvider`，无需额外包裹。

### 2. 引入主题样式

```tsx
// main.tsx
import '@skillchat/harness-react/theme.css';
```

### 3. 配置 Tailwind

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import harnessKitPreset from '@skillchat/harness-react/tailwind';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@skillchat/harness-react/dist/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [harnessKitPreset as Config],
  plugins: [typography],
} satisfies Config;
```

完整示例见 [examples/minimal-react/tailwind.config.ts](../examples/minimal-react/tailwind.config.ts)。

### 4. 挂载聊天组件

```tsx
import { HarnessChatProvider, HarnessChat } from '@skillchat/harness-react';

export function App() {
  return (
    <HarnessChatProvider apiBase="/api/chat" credentials="include">
      <HarnessChat />
    </HarnessChatProvider>
  );
}
```

`<HarnessChat />` 会在首条消息时自动 `POST /sessions` 创建会话，无需手动管理 sessionId。

仅使用 Hooks、完全自定义 UI 时见 [INTEGRATION.md — Headless 模式](./INTEGRATION.md#headless-模式)。

### 5. Vite 开发代理

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

## 本地验证（无需新建项目）

在 harness-kit 仓库根目录：

```bash
npm install
npm run build
cp examples/minimal-server/.env.example examples/minimal-server/.env
# 编辑 .env，填入 OPENAI_API_KEY
npm run dev:demo
```

- 后端：`http://localhost:3000/api/chat`
- 前端：`http://localhost:5173`

详见 [examples/demo/README.md](../examples/demo/README.md)。

---

## 环境变量（最小集）

| 变量 | 默认 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | — | **必填** |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 兼容端点 |
| `OPENAI_MODEL` | `gpt-5.4` | 默认模型 |
| `HARNESSKIT_DATA_ROOT` | `./data` | 持久化目录 |

完整变量表见 [ADVANCED.md](./ADVANCED.md#环境变量)。
