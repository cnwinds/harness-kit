# HarnessKit 主题与配色

HarnessKit React 组件**不硬编码颜色**，全部通过 CSS 变量（`--hk-*`）驱动，宿主应用可按品牌自由定制。

## 设计原则

| 原则 | 说明 |
|---|---|
| **语义化 Token** | `accent`、`surface`、`textMuted` 等，而非 `blue-500` |
| **作用域隔离** | 变量注入在 `.hk-chat-root` 容器上，不污染全局 `:root` |
| **继承宿主** | 支持从宿主 CSS 变量（如 SkillChat 的 `--background`）自动映射 |
| **三层覆盖** | preset → inheritCssVariables → theme partial |

## 快速使用

### 内置预设

```tsx
<HarnessChatProvider preset="light">
  <HarnessChat />
</HarnessChatProvider>

<HarnessChatProvider preset="dark">
  <HarnessChat />
</HarnessChatProvider>
```

### 自定义配色

```tsx
<HarnessChatProvider
  preset="light"
  theme={{
    colors: {
      accent: '#c96442',        // 品牌主色
      accentForeground: '#fff',
      userBubble: '#fdf6f3',
    },
    radius: { md: '12px' },
    fontFamily: '"Inter", sans-serif',
  }}
>
  <HarnessChat />
</HarnessChatProvider>
```

### 继承宿主应用 CSS 变量（推荐）

SkillChat 等已有设计系统的应用，一行继承：

```tsx
<HarnessChatProvider
  apiBase="/api"
  inheritCssVariables   // 读取 :root 的 --background, --accent 等
>
  <HarnessChat />
</HarnessChatProvider>
```

自定义变量名映射：

```tsx
<HarnessChatProvider
  inheritCssVariables={{
    background: '--app-bg',
    accent: '--brand-primary',
    text: '--app-text',
  }}
/>
```

## Token 列表

| Token | CSS 变量 | 用途 |
|---|---|---|
| `background` | `--hk-background` | 聊天区域背景 |
| `surface` | `--hk-surface` | 卡片、输入框背景 |
| `surfaceHover` | `--hk-surface-hover` | 悬停态 |
| `border` | `--hk-border` | 分割线、边框 |
| `text` | `--hk-text` | 主文字 |
| `textMuted` | `--hk-text-muted` | 次要文字、状态栏 |
| `accent` | `--hk-accent` | 主按钮、焦点环 |
| `accentForeground` | `--hk-accent-fg` | 主按钮文字 |
| `danger` | `--hk-danger` | 停止/危险操作 |
| `userBubble` | `--hk-user-bubble` | 用户消息气泡 |
| `assistantBubble` | `--hk-assistant-bubble` | 助手消息气泡 |
| `composerBackground` | `--hk-composer-bg` | 输入区背景 |

## Headless 模式

不渲染 `<HarnessChat />` 时，仍可通过 `useHarnessTheme()` 读取当前主题：

```tsx
const theme = useHarnessTheme();
// theme.colors.accent → 用于自定义 Composer 按钮
```

或手动注入 CSS 变量：

```tsx
import { themeToCssProperties, resolveTheme } from '@harnesskit/react';

const vars = themeToCssProperties(resolveTheme({ preset: 'dark' }));
<div style={vars as React.CSSProperties}>
  <MyCustomComposer />
</div>
```

## 运行时切换主题

主题随 `HarnessChatProvider` props 更新而响应式变化（如跟随系统 dark mode）：

```tsx
const { themeMode } = usePreferences();

<HarnessChatProvider
  preset={themeMode === 'dark' ? 'dark' : 'light'}
  inheritCssVariables
>
```

## 与 Tailwind 共存

HarnessKit 提供可选 Tailwind preset，映射 `--hk-*` 语义色与 `prose-hk-chat` 排版：

```typescript
import type { Config } from 'tailwindcss';
import harnessKitPreset from '@harnesskit/react/tailwind';

export default {
  presets: [harnessKitPreset],
  content: ['./src/**/*.{ts,tsx}', './node_modules/@harnesskit/react/dist/**/*.js'],
} satisfies Config;
```

Markdown 气泡：`className="prose prose-hk-chat"`。

HarnessKit 组件也使用语义 class + CSS 变量，**不强制 Tailwind**。宿主应用可继续用 Tailwind 布局包裹：

```tsx
<div className="flex h-full">
  <Sidebar />
  <HarnessChat className="flex-1" />
</div>
```

## 扩展（Phase 3）

- 组件级 slot classNames（`composerClassName` 等）
- `createTheme()` 工厂 + 主题 JSON 导入
- 高对比度 / 无障碍 preset
