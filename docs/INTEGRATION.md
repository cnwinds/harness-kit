# HarnessKit 接入指南

## 快速开始

### 1. 安装

```bash
npm install @harnesskit/server @harnesskit/react @harnesskit/protocol
```

### 2. 后端（Fastify）

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createHarnessChat } from '@harnesskit/server';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const chat = createHarnessChat({
  llm: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
  },
  dataRoot: './data',
});

await chat.mount(app, { prefix: '/api/chat' });
await app.listen({ port: 3000, host: '0.0.0.0' });
```

### 3. 前端（React + Vite）

```tsx
// main.tsx
import { HarnessChatProvider } from '@harnesskit/react';

root.render(
  <HarnessChatProvider apiBase="/api/chat" credentials="include">
    <App />
  </HarnessChatProvider>,
);
```

```tsx
// ChatPage.tsx — 方式 A：开箱即用
import { HarnessChat } from '@harnesskit/react';

export function ChatPage() {
  return <HarnessChat />;
}
```

```tsx
// ChatPage.tsx — 方式 B：Headless（应用自管 sessionId + 自定义 UI）
import { useState } from 'react';
import { useHarnessChat, MessageItem, Composer } from '@harnesskit/react';

export function ChatPage() {
  // 会话列表/创建由应用层负责（例如 SkillChat 的 /api/sessions）。
  // 传入 sessionId 后，useHarnessChat 会拉取 messages/runtime 并订阅 SSE。
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chat = useHarnessChat({ sessionId });

  return (
    <div>
      {chat.messages.map((event) =>
        event.kind === 'message' ? <MessageItem key={event.id} event={event} /> : null,
      )}
      {chat.streamingText ? <p>{chat.streamingText}</p> : null}
      <Composer
        onSend={(content) => void chat.send(content)}
        disabled={chat.streamStatus === 'connecting'}
      />
      <button type="button" onClick={() => void chat.interrupt()} disabled={!chat.runtime?.activeTurn}>
        停止
      </button>
    </div>
  );
}
```

> **说明：** HarnessKit 不提供 `useHarnessSessions`。会话 CRUD 属于应用层；`createHarnessChat()` 挂载的是消息、runtime、SSE 等 Harness 路由。若 `useHarnessChat.send()` 在未传入 `sessionId` 时自动建会话，需应用额外提供 `POST {apiBase}/sessions`。

### 4. Vite 代理

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/chat': 'http://localhost:3000',
    },
  },
});
```

---

## 认证集成

默认 `AnonymousAuthResolver`（单用户 demo）。生产环境：

```typescript
import type { AuthResolver, ChatUser } from '@harnesskit/server';

const jwtAuth: AuthResolver = {
  async resolve(request) {
    const token = parseCookie(request, 'session');
    if (!token) return null;
    const payload = await verifyJwt(token);
    return { id: payload.sub, username: payload.name, role: 'member' };
  },
};

createHarnessChat({
  llm: { apiKey: '...' },
  auth: jwtAuth,
});
```

前端需 `credentials: 'include'` 或 Bearer token 头（通过 `fetchOptions` 配置）。

---

## Skill 集成

```typescript
import type { SkillCatalogProvider } from '@harnesskit/core';

const mySkills: SkillCatalogProvider = {
  async listAvailable(userId) {
    return [{ id: 'my/pdf', name: 'PDF', description: '...' }];
  },
  async resolveInstructions(sessionId, skillIds) {
    return skillIds.map((id) => readSkillMd(id)).join('\n\n');
  },
};

createHarnessChat({
  llm: { apiKey: '...' },
  skills: mySkills,
});
```

---

## 消息调度模式

```typescript
await chat.send('继续优化', { mode: 'steer' });      // Mid-turn 引导
await chat.send('新话题', { mode: 'new_turn' });     // 强制新 turn
await chat.send('稍后处理', { mode: 'queue_next' }); // 排队
await chat.send('自动', { mode: 'auto' });           // 默认：能 steer 则 steer，否则 queue
```

---

## SSE 事件处理（自定义客户端）

若不使用 `@harnesskit/react`，可直接消费 SSE：

```typescript
import { SSE_EVENT_NAMES, type SSEEventName } from '@harnesskit/protocol';
import { fetchEventSource } from '@microsoft/fetch-event-source';

await fetchEventSource(`/api/chat/sessions/${sessionId}/stream`, {
  credentials: 'include',
  onmessage(ev) {
    const event = ev.event as SSEEventName;
    const data = JSON.parse(ev.data);
    // handle text_delta, turn_completed, done, ...
  },
});
```

重连后务必：

```typescript
const [messages, runtime] = await Promise.all([
  fetch(`/api/chat/sessions/${id}/messages`).then((r) => r.json()),
  fetch(`/api/chat/sessions/${id}/runtime`).then((r) => r.json()),
]);
```

---

## 联网搜索与生图

HarnessKit 将**搜索**与**生图**作为可选工具能力暴露给模型：是否调用由模型根据对话内容决定，而不是每轮请求强制触发。Provider 的激活、顺序与失败策略由配置驱动。

### 设计原则

| 原则 | 说明 |
|------|------|
| 官方 OpenAI | `OPENAI_BASE_URL` 为 `api.openai.com` 时，Native 搜索/生图在 `auto` 策略下默认开启 |
| 中转 / 兼容端点 | Native 能力默认关闭，可用 `on` 显式信任中继；三方 Provider 靠 key 激活 |
| 多 Provider | 配置了多个 key 时按链依次尝试；失败不降级到硬编码抓取 |
| 粘性路由 | 上次成功的 Provider 写入 `{DATA_ROOT}/.provider-prefs.json`，下次优先使用 |

### Native 能力策略

```bash
OPENAI_NATIVE_WEB_SEARCH=auto        # auto | on | off，默认 auto
OPENAI_NATIVE_IMAGE_GENERATION=auto  # auto | on | off，默认 auto
```

| 策略 | 官方 `api.openai.com` | 中转站（如 DashScope） |
|------|----------------------|------------------------|
| `auto` | 开启 Native | 关闭 Native |
| `on` | 开启 | 开启（需中继支持） |
| `off` | 关闭 | 关闭 |

- **Native 搜索**：模型调用 `web_search` 工具后，内部走 OpenAI Responses API 原生 `web_search`
- **Native 生图**：主对话注册 Responses `image_generation` 工具；失败时自动 fallback 到已配置的三方生图链

### 联网搜索

#### 总开关

```bash
WEB_SEARCH_MODE=live    # live | cached | disabled
```

`disabled` 时不会向模型暴露 `web_search` 工具。

#### 支持的 Provider

| ID | 激活条件 | 说明 |
|----|----------|------|
| `openai_native` | Native 搜索策略为 `on`，或 `auto` + 官方端点 | OpenAI Responses 原生搜索 |
| `tavily` | `TAVILY_API_KEY` 非空 | [Tavily](https://tavily.com) |
| `serper` | `SERPER_API_KEY` 非空 | [Serper](https://serper.dev) |
| `brave` | `BRAVE_SEARCH_API_KEY` 非空 | [Brave Search API](https://brave.com/search/api/) |

有 key 即自动加入可用链，无需再单独「启用」某个 Provider。

#### 尝试顺序

```bash
# 可选；不配则按默认顺序，且仅包含已激活的 Provider
WEB_SEARCH_PROVIDERS=openai_native,tavily,serper,brave
```

默认顺序：`openai_native` → `tavily` → `serper` → `brave`（跳过未配置 key 或未开启 Native 的项）。

失败时依次尝试下一个；全部失败则工具返回明确错误信息给模型，由模型向用户说明无法联网检索。

#### 示例：官方 OpenAI

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
WEB_SEARCH_MODE=live
# Native 搜索 auto 开启，一般无需额外 key
```

#### 示例：DashScope + Tavily

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen3.5-plus

OPENAI_NATIVE_WEB_SEARCH=off
WEB_SEARCH_MODE=live
WEB_SEARCH_PROVIDERS=tavily
TAVILY_API_KEY=tvly-...
```

#### Bootstrap 代码配置

```typescript
createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
  webSearchMode: 'live',
  webSearchProviders: 'tavily,serper',
  openaiNativeWebSearch: 'off',
});
```

搜索相关的 API Key（`TAVILY_API_KEY` 等）仍通过环境变量注入，`resolveBootstrapConfig` 会自动读取。

### 生图

生图有两条路径：

| 路径 | 何时使用 | 配置 |
|------|----------|------|
| **Responses 原生** | Native 生图策略开启 | 复用 `OPENAI_API_KEY` + `OPENAI_BASE_URL` |
| **`generate_image` 工具** | 至少配置一个三方生图 Provider | 各 Provider 独立的 key / baseUrl / model |

Native 生图失败时，若已配置三方 Provider，会自动 fallback 到生图链。

#### 支持的 Provider

| ID | 必需配置 | 可选配置 | 默认 model |
|----|----------|----------|------------|
| `openai_images` | `OPENAI_IMAGE_API_KEY` | `OPENAI_IMAGE_BASE_URL` | `gpt-image-2` |
| `zhipu` | `ZHIPU_IMAGE_API_KEY` | `ZHIPU_IMAGE_BASE_URL` | `glm-image` |
| `bailian` | `DASHSCOPE_IMAGE_API_KEY` + `DASHSCOPE_IMAGE_MODEL` | `DASHSCOPE_IMAGE_BASE_URL` | 无（必须显式配置 model） |

每个 Provider 需要 **API Key + Model** 才会激活（OpenAI / 智谱的 model 有默认值；百炼必须写明 model）。

#### 尝试顺序

```bash
IMAGE_PROVIDERS=openai_images,zhipu,bailian
```

默认顺序：`openai_images` → `zhipu` → `bailian`。成功记录写入 `.provider-prefs.json`，与搜索共用同一文件。

#### 示例：智谱生图

```bash
OPENAI_NATIVE_IMAGE_GENERATION=off

ZHIPU_IMAGE_API_KEY=...
ZHIPU_IMAGE_MODEL=glm-image
ZHIPU_IMAGE_BASE_URL=https://open.bigmodel.cn/api/paas/v4
IMAGE_PROVIDERS=zhipu
```

#### 示例：官方 Native + 智谱 fallback

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_NATIVE_IMAGE_GENERATION=auto

ZHIPU_IMAGE_API_KEY=...
ZHIPU_IMAGE_MODEL=glm-image
IMAGE_PROVIDERS=openai_images,zhipu
```

#### Bootstrap 代码配置

```typescript
createHarnessChatBootstrap({
  llm: { apiKey: process.env.OPENAI_API_KEY! },
  dataRoot: './data',
  openaiNativeImageGeneration: 'auto',
  imageProviders: 'openai_images,zhipu',
});
```

生图 API Key 与 model 通过环境变量配置，见下方环境变量表。

### 工具暴露规则

| 工具 | 暴露条件 |
|------|----------|
| `web_search` | `WEB_SEARCH_MODE !== disabled` 且链上至少 1 个搜索 Provider |
| `web_fetch` | `ENABLE_ASSISTANT_TOOLS=true`（默认） |
| Responses `image_generation` | Native 生图策略开启 |
| `generate_image` | 至少 1 个三方生图 Provider 已激活 |

### Provider 偏好持久化

路径：`{HARNESSKIT_DATA_ROOT}/.provider-prefs.json`

```json
{
  "webSearch": {
    "preferredProviderId": "tavily",
    "lastSuccessAt": "2026-06-28T12:00:00.000Z"
  },
  "imageGeneration": {
    "preferredProviderId": "zhipu",
    "lastSuccessAt": "2026-06-28T12:00:00.000Z"
  }
}
```

下次构建 Provider 链时，会将 `preferredProviderId` 排在最前，其余保持配置顺序。

---

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | — | LLM API Key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 兼容端点 |
| `OPENAI_MODEL` | `gpt-5.4` | 默认模型 |
| `HARNESSKIT_DATA_ROOT` | `./data` | 数据目录（含 `.provider-prefs.json`） |
| `HARNESSKIT_INLINE_JOBS` | `false` | 同步等待 turn 完成 |
| `WEB_SEARCH_MODE` | `live` | 搜索总开关：`live` / `cached` / `disabled` |
| `WEB_SEARCH_PROVIDERS` | — | 搜索 Provider 顺序，逗号分隔 |
| `OPENAI_NATIVE_WEB_SEARCH` | `auto` | Native 搜索：`auto` / `on` / `off` |
| `TAVILY_API_KEY` | — | Tavily 搜索 key |
| `SERPER_API_KEY` | — | Serper 搜索 key |
| `BRAVE_SEARCH_API_KEY` | — | Brave 搜索 key |
| `OPENAI_NATIVE_IMAGE_GENERATION` | `auto` | Native 生图：`auto` / `on` / `off` |
| `IMAGE_PROVIDERS` | — | 生图 Provider 顺序，逗号分隔 |
| `OPENAI_IMAGE_API_KEY` | — | OpenAI Images API key |
| `OPENAI_IMAGE_BASE_URL` | `https://api.openai.com/v1` | OpenAI 生图端点 |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` | OpenAI 生图模型 |
| `ZHIPU_IMAGE_API_KEY` | — | 智谱生图 key |
| `ZHIPU_IMAGE_BASE_URL` | 智谱官方 | 智谱生图端点 |
| `ZHIPU_IMAGE_MODEL` | `glm-image` | 智谱生图模型 |
| `DASHSCOPE_IMAGE_API_KEY` | — | 百炼生图 key |
| `DASHSCOPE_IMAGE_BASE_URL` | DashScope 官方 | 百炼生图端点 |
| `DASHSCOPE_IMAGE_MODEL` | — | 百炼生图模型（必填才激活） |

完整示例见 `examples/minimal-server/.env.example`。搜索与生图行为说明见上文 [联网搜索与生图](#联网搜索与生图)。

---

## 示例项目

```bash
cd harness-kit
npm install
npm run dev:minimal-server   # :3000
npm run dev:minimal-react    # :5173
```

见 `examples/minimal-server` 与 `examples/minimal-react`。
