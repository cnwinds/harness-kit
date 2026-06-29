# 从 SkillChat 迁移到 HarnessKit

> SkillChat 已完成 Phase 4 接入（2026-06-27）

## 映射关系

| SkillChat（已删除/替换） | HarnessKit |
|---|---|
| `@skillchat/shared` 事件类型 | `@skillchat/harness-protocol` |
| `apps/server/src/core/turn/*` | `@skillchat/harness-core` |
| `apps/server/src/core/stream/stream-hub.ts` | `@skillchat/harness-core` |
| `apps/server/src/modules/chat/*` | `@skillchat/harness` + `@skillchat/harness-server` |
| `apps/web/src/stores/ui-store.ts` (streams) | `@skillchat/harness-react` `useStreamUiStore` |
| `apps/web/src/components/chat/*` | `@skillchat/harness-react/components`（可选逐步替换） |

## SkillChat 当前接入方式

### Server

```typescript
import { MessageStore, StreamHub, ensureBaseDirectories } from '@skillchat/harness-core';
import { createOpenAIHarnessStack, SessionContextStore } from '@skillchat/harness';
import { ChatOrchestrator } from '@skillchat/harness-server';
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
"@skillchat/harness-core": "file:../../../harness-kit/packages/core"
```

修改 harness-kit 后需先 `npm run build`，再在 skill-chat 执行 `npm install --engine-strict=false`。

## 保留在 SkillChat 应用层

- `modules/auth/*`、`modules/skills/*`、`modules/admin/*`
- `core/storage/paths.ts`、`fs-utils.ts`（应用目录布局）
- SQLite、业务路由、Skill 市场 UI

## Tailwind 集成

```typescript
// tailwind.config.ts
import harnessPreset from '@skillchat/harness-react/tailwind';

export default {
  presets: [harnessPreset],
  // ...
};
// Markdown 气泡内使用 prose prose-hk-chat
```
