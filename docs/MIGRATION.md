# 从 SkillChat 迁移到 HarnessKit

## 映射关系

| SkillChat | HarnessKit |
|---|---|
| `@skillchat/shared` | `@harnesskit/protocol` |
| `apps/server/src/core/turn/*` | `@harnesskit/core/turn` |
| `apps/server/src/core/stream/stream-hub.ts` | `@harnesskit/core/stream` |
| `apps/server/src/modules/chat/openai-harness.ts` | `@harnesskit/harness` |
| `apps/server/src/modules/chat/chat-service.ts` | `@harnesskit/server/orchestrator` |
| `apps/server/src/app.ts` (chat routes) | `@harnesskit/server/routes` |
| `apps/web/src/hooks/useSessionStream.ts` | `@harnesskit/react/hooks/useHarnessStream` |
| `apps/web/src/stores/ui-store.ts` (streams) | `@harnesskit/react/store` |
| `apps/web/src/components/chat/*` | `@harnesskit/react/components` |

## 保留在 SkillChat 应用层

- `modules/auth/*` — 登录、注册、邀请码
- `modules/skills/market-client.ts` — Skill 市场
- `modules/admin/*` — 管理面板
- `routes/admin/*`, `routes/market/*` — 业务路由
- SQLite 用户表、system_settings

## 迁移步骤

### Step 1：引入 HarnessKit

```json
{
  "dependencies": {
    "@harnesskit/protocol": "workspace:*",
    "@harnesskit/server": "workspace:*",
    "@harnesskit/react": "workspace:*"
  }
}
```

可先用 npm link / workspace 引用本地 `harness-kit`。

### Step 2：替换 shared 导入

```diff
- import type { StoredEvent } from '@skillchat/shared';
+ import type { StoredEvent } from '@harnesskit/protocol';
```

### Step 3：Server 改用 createHarnessChat

```typescript
// apps/server/src/app.ts
import { createHarnessChat } from '@harnesskit/server';
import { skillChatAuthResolver } from './modules/auth/harness-auth.js';
import { skillChatSkillCatalog } from './modules/skills/skill-catalog-adapter.js';

const chat = createHarnessChat({
  llm: loadModelConfig(env),
  dataRoot: env.DATA_ROOT,
  auth: skillChatAuthResolver,
  skills: skillChatSkillCatalog,
  files: skillChatFileProvider,
  scripts: skillChatScriptExecutor,
});

await chat.mount(app, { prefix: '/api' });
// 删除原有 chat 相关路由注册
```

### Step 4：Web 改用 HarnessKit React

```tsx
// apps/web/src/routes/app/ChatPage.tsx
import { HarnessChatProvider, useHarnessChat } from '@harnesskit/react';
```

逐步替换 `useSessionStream` + `ui-store.streams`。

### Step 5：删除已迁移代码

确认测试通过后删除：

- `apps/server/src/core/turn/`（已进 core 包）
- `apps/server/src/modules/chat/openai-harness.ts`
- `packages/shared/`（若完全被 protocol 替代）

## 兼容性

- SSE 事件名与 payload **保持不变**，旧客户端可继续工作
- REST 路径默认 `/api/chat/*`，SkillChat 可通过 `prefix: '/api'` 保持原路径
- 数据目录布局兼容：`data/users/{userId}/sessions/{sessionId}/`

## 风险

| 风险 | 缓解 |
|---|---|
| ChatService 隐式依赖 | Orchestrator 显式 DI，集成测试覆盖 |
| Auth cookie 路径 | mount prefix 与 cookie path 对齐 |
| Skill 脚本路径 | ScriptExecutor adapter 封装现有 RunnerManager |
