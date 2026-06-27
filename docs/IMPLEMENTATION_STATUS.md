# HarnessKit 实施状态

> 更新：2026-06-27

## Phase 1 — 契约与骨架 ✅

- Monorepo 脚手架
- `@harnesskit/protocol` SSE / 事件 / Zod schema
- 主题系统（`docs/THEMING.md`）

## Phase 2 — 核心迁移 ✅

| 模块 | 包 | 状态 |
|---|---|---|
| Turn Runtime | `@harnesskit/core` | ✅ |
| MessageStore / StreamHub | `@harnesskit/core` | ✅ |
| OpenAIHarness | `@harnesskit/harness` | ✅ |
| ChatOrchestrator | `@harnesskit/server` | ✅ |
| createHarnessChat | `@harnesskit/server` | ✅ |

## Phase 3 — React UI ✅

- `HarnessChatProvider` + 主题 / auth / filesApi 注入
- `useStreamUiStore` + `useSessionStream`
- 完整聊天组件导出：`MessageItem`、`Composer`、`FollowUpQueue` 等
- `useFilePreviewUrl` / `useImagePreview` / `useComposerAttachments`
- Tailwind preset：`@harnesskit/react/tailwind`（`prose-hk-chat`）
- 测试辅助：`setHarnessChatTestContext`

## Phase 4 — SkillChat 接入 ✅

- Server：`ChatOrchestrator` + `@harnesskit/core/harness/server`
- Web：`HarnessChatProvider` + `useStreamUiStore` from `@harnesskit/react`
- Web：`useSessionStream` 本地薄封装（auth 来自 SkillChat store，避免 Vitest 双 React 实例）
- 已删除重复服务端代码：`core/turn/*`、`modules/chat/*`、`modules/tools/*` 等

## 验证命令

```bash
cd D:\ai_projects\harness-kit && npm run build

cd D:\ai_projects\skill-chat
npm install --engine-strict=false
npm run typecheck --workspace @skillchat/server
npm run typecheck --workspace @skillchat/web
npm run test --workspace @skillchat/server
npm run test --workspace @skillchat/web
```
