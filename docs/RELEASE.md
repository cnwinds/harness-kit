# HarnessKit 发布指南

## 包与顺序

| 包 | 说明 |
|----|------|
| `@skillchat/harness-protocol` | 类型与 SSE 契约 |
| `@skillchat/harness-core` | Turn 运行时 |
| `@skillchat/harness` | LLM Harness 引擎 |
| `@skillchat/harness-server` | Fastify 适配器 |
| `@skillchat/harness-react` | React UI |

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

## 首次发布前：npm 组织 `@skillchat`

包发布到 **`@skillchat`** 组织（与 SkillChat 产品同名）。组织创建后，owner 账号即可发布 `@skillchat/harness-*`。

> 注：`@harnesskit` scope 已被其他项目占用，请勿使用。

## 私有注册表

在仓库根目录创建 `.npmrc`，例如 GitLab：

```ini
@skillchat:registry=https://gitlab.com/api/v4/projects/<id>/packages/npm/
//gitlab.com/api/v4/projects/<id>/packages/npm/:_authToken=${GITLAB_NPM_TOKEN}
```

`publishConfig.access` 在各 package 中已设为 `public`；私有 GitLab 包按 GitLab 文档改为 `restricted` 即可。
