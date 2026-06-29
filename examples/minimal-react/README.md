# minimal-react

HarnessKit 前端最小示例：React + Vite + `HarnessChatProvider` + `HarnessChat`。

## 启动

```bash
# 在仓库根目录（需先启动后端）
npm run dev:minimal-react   # http://localhost:5173
```

或与后端一起启动：`npm run dev:demo`

## 核心文件

| 文件 | 说明 |
|------|------|
| [src/main.tsx](./src/main.tsx) | Provider + HarnessChat 挂载 |
| [tailwind.config.ts](./tailwind.config.ts) | `@harnesskit/react/tailwind` preset |
| [vite.config.ts](./vite.config.ts) | `/api/chat` 代理到 :3000 |

## 依赖清单

使用 `<HarnessChat />` 开箱 UI 需要：

**dependencies：** `@harnesskit/react`、`@tanstack/react-query`、`lucide-react`、`react-markdown`、`remark-gfm`

**devDependencies：** `tailwindcss`、`@tailwindcss/typography`、`postcss`、`autoprefixer`

另需在入口引入 `@harnesskit/react/theme.css`。

## 文档

- [API 参考](../../docs/API.md)
- [快速开始](../../docs/QUICKSTART.md)
- [主题定制](../../docs/THEMING.md)
