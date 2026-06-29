# HarnessKit

> **一行代码接入 AI Harness 聊天** — 从 [SkillChat](https://github.com/cnwinds/skill-chat) 提炼的可复用聊天 Harness 库。

HarnessKit 将 Turn 调度、SSE 流式协议、LLM Agent Loop 与 React 客户端拆成独立 npm 包，让任意项目快速获得与 SkillChat 同级的 Harness 聊天能力。

**前置条件：** Node.js >= 22 · React 18+

## 包结构

| 包 | 说明 |
|---|---|
| `@skillchat/harness-protocol` | 跨端类型、Zod Schema、SSE 事件契约 |
| `@skillchat/harness-core` | Turn 运行时、StreamHub、可插拔持久化 |
| `@skillchat/harness` | LLM Harness 引擎（OpenAI Responses）与 Tool 调度 |
| `@skillchat/harness-server` | Fastify 适配器，`createHarnessChatBootstrap()` 一行挂载 |
| `@skillchat/harness-react` | React Hooks + 可选 UI 组件 |

## 一行接入

### 后端

```typescript
import Fastify from 'fastify';
import { createHarnessChatBootstrap } from '@skillchat/harness-server';

const app = Fastify();
const chat = createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
});

await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000 });
```

### 前端

```tsx
import { HarnessChatProvider, HarnessChat } from '@skillchat/harness-react';
import '@skillchat/harness-react/theme.css';

export function ChatPage() {
  return (
    <HarnessChatProvider apiBase="/api/chat" credentials="include">
      <HarnessChat />
    </HarnessChatProvider>
  );
}
```

使用 `<HarnessChat />` 还需配置 Tailwind 与 peer dependencies，详见 [快速开始](./docs/QUICKSTART.md)。

Headless 模式：

```tsx
import { HarnessChatProvider, useHarnessChat } from '@skillchat/harness-react';

export function ChatPage() {
  return (
    <HarnessChatProvider apiBase="/api/chat">
      <MyComposer />
    </HarnessChatProvider>
  );
}

function MyComposer({ sessionId }: { sessionId: string | null }) {
  const { send, interrupt, runtime, streamingText } = useHarnessChat({ sessionId });
  // 完全自定义 UI
}
```

## 文档

| 文档 | 内容 |
|------|------|
| [快速开始](./docs/QUICKSTART.md) | 安装、Bootstrap、前端依赖、Vite 代理 |
| [API 参考](./docs/API.md) | REST 路由、SSE 事件、数据模型 |
| [接入指南](./docs/INTEGRATION.md) | 认证、Skill、Headless、底层 API |
| [进阶配置](./docs/ADVANCED.md) | 联网搜索、生图、环境变量 |
| [总体设计](./docs/DESIGN.md) | 架构目标与核心概念 |
| [架构分层](./docs/ARCHITECTURE.md) | 包职责、扩展点 |
| [主题定制](./docs/THEMING.md) | CSS 变量与 preset |
| [从 SkillChat 迁移](./docs/MIGRATION.md) | 已有 SkillChat 项目迁移 |

## 开发

```bash
npm install
npm run build
npm run typecheck
npm run test
npm run dev:demo   # 全栈 demo（需 OPENAI_API_KEY）
```

完整对接示例见 [examples/demo/README.md](./examples/demo/README.md)。

## 与 SkillChat 的关系

```
SkillChat (应用)          HarnessKit (库)
├── Auth / Admin     →    (应用层保留)
├── Skill Market     →    (通过 SkillCatalogProvider 插件)
├── Chat UI          →    @skillchat/harness-react
└── Turn + Harness   →    @skillchat/harness-core + harness + server
```

## 发布到 npm

SkillChat 生产部署从 npm 安装 `@skillchat/harness-*`。发布流程见：

- [docs/RELEASE.md](./docs/RELEASE.md)

```bash
npm test
npm version 0.1.1 -ws
npm run publish:packages
```

## License

MIT
