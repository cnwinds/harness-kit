# HarnessKit 发布指南

## 包与顺序

| 包 | 说明 |
|----|------|
| `@harnesskit/protocol` | 类型与 SSE 契约 |
| `@harnesskit/core` | Turn 运行时 |
| `@harnesskit/harness` | LLM Harness 引擎 |
| `@harnesskit/server` | Fastify 适配器 |
| `@harnesskit/react` | React UI |

发布顺序：`protocol → core → harness → server → react`（由 `scripts/publish-packages.mjs` 执行）。

## 发布步骤

```bash
# 1. 测试
npm test

# 2. 统一 bump 版本（示例）
npm version 0.1.1 -ws

# 3. 登录 npm（或配置 .npmrc 私有源）
npm login

# 4. 发布
npm run publish:packages

# 预发布标签
npm run publish:packages -- --tag next

# 演练
npm run publish:packages -- --dry-run
```

## 发布后

1. 通知 skill-chat 维护者更新 `config/harness-deps.manifest.json` 的 `registryVersion`
2. skill-chat 执行 `npm run harness:registry -- --version=<新版本>` 并验证 Docker 构建

## 私有注册表

在仓库根目录创建 `.npmrc`，例如 GitLab：

```ini
@harnesskit:registry=https://gitlab.com/api/v4/projects/<id>/packages/npm/
//gitlab.com/api/v4/projects/<id>/packages/npm/:_authToken=${GITLAB_NPM_TOKEN}
```

`publishConfig.access` 在各 package 中已设为 `public`；私有 GitLab 包按 GitLab 文档改为 `restricted` 即可。
