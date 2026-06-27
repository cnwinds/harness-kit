# 从 SkillChat 迁移到 HarnessKit

> SkillChat 已完成 Phase 4 接入（2026-06-27）

## 映射关系

| SkillChat（已删除/替换） | HarnessKit |
|---|---|
| `@skillchat/shared` 事件类型 | `@harnesskit/protocol` |
| `apps/server/src/core/turn/*` | `@harnesskit/core` |
| `apps/server/src/core/stream/stream-hub.ts` | `@harnesskit/core` |
| `apps/server/src/modules/chat/*` | `@harnesskit/harness` + `@harnesskit/server` |
| `apps/web/src/stores/ui-store.ts` (streams) | `@harnesskit/react` `useStreamUiStore` |
| `apps/web/src/components/chat/*` | `@harnesskit/react/components`（可选逐步替换） |

## SkillChat 当前接入方式

### Server

```typescript
import { MessageStore, StreamHub, ensureBaseDirectories } from '@harnesskit/core';
import { createOpenAIHarnessStack, SessionContextStore } from '@harnesskit/harness';
import { ChatOrchestrator } from '@harnesskit/server';
import { toHarnessConfig } from './adapters/harness-config.js';
import { toSkillRegistryLike } from './adapters/harness-adapters.js';
```

### Web

```tsx
// main.tsx — HarnessAuthBridge 注入 auth + filesApi
<HarnessChatProvider apiBase="/api" inheritCssVariables auth={auth} filesApi={filesApi}>

// 流式状态
import { useStreamUiStore } from '@/lib/harness-stream';
import { useSessionStream } from '@/lib/harness-stream'; // 薄封装，auth 来自 SkillChat store
```

### 本地 file: 依赖

```json
"@harnesskit/core": "file:../../../harness-kit/packages/core"
```

修改 harness-kit 后需先 `npm run build`，再在 skill-chat 执行 `npm install --engine-strict=false`。

## 保留在 SkillChat 应用层

- `modules/auth/*`、`modules/skills/*`、`modules/admin/*`
- `core/storage/paths.ts`、`fs-utils.ts`（应用目录布局）
- SQLite、业务路由、Skill 市场 UI

## Tailwind 集成

```typescript
// tailwind.config.ts
import harnessPreset from '@harnesskit/react/tailwind';

export default {
  presets: [harnessPreset],
  // ...
};
// Markdown 气泡内使用 prose prose-hk-chat
```
