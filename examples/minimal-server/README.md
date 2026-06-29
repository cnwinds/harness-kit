# minimal-server

HarnessKit 后端最小示例：Fastify + `createHarnessChatBootstrap`。

## 启动

```bash
# 在仓库根目录
cp examples/minimal-server/.env.example examples/minimal-server/.env
# 编辑 .env，填入 OPENAI_API_KEY

npm run dev:minimal-server   # http://localhost:3000/api/chat
```

或与前端一起启动：`npm run dev:demo`

## 核心代码

见 [src/index.ts](./src/index.ts) — 约 60 行，含 CORS、环境变量解析与 Bootstrap 挂载。

## 配置

- `.env` — LLM、搜索、生图等（见 [.env.example](./.env.example)）
- `HARNESSKIT_DATA_ROOT` — 默认 `./data`，存放会话与消息

## 文档

- [API 参考](../../docs/API.md)
- [快速开始](../../docs/QUICKSTART.md)
- [进阶配置](../../docs/ADVANCED.md)
