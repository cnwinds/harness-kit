# API 参考

HarnessKit 服务端 HTTP + SSE 契约。类型定义以 `@harnesskit/protocol` 为准；本文描述默认 `createHarnessChatBootstrap` 挂载后的行为。

**相关文档：** [快速开始](./QUICKSTART.md) · [接入指南](./INTEGRATION.md)

---

## 概览

| 项 | 说明 |
|----|------|
| 默认前缀 | `/api/chat`（`mount(app, { prefix })` 可改） |
| 内容类型 | 请求 / 响应均为 `application/json`（文件下载除外） |
| 认证 | 由 `AuthResolver` 解析；默认匿名用户 `{ id: 'anonymous' }` |
| 实时通道 | SSE（`text/event-stream`），**不缓冲**离线事件 |
| 权威数据源 | 消息历史与 runtime 以 **REST** 为准；SSE 仅推送增量 |

### 路由可用性

| 路由组 | `createHarnessChat` | `createHarnessChatBootstrap` |
|--------|---------------------|------------------------------|
| 会话 `GET/POST /sessions` | ❌ 需应用自建 | ✅ |
| 消息 / runtime / stream / turn | ✅ | ✅ |
| 文件 preview / download | ❌ | ✅ |

---

## REST 端点总览

| 方法 | 路径 | 状态码 | 说明 |
|------|------|--------|------|
| GET | `{prefix}/sessions` | 200 | 会话列表（Bootstrap） |
| POST | `{prefix}/sessions` | 201 | 创建会话（Bootstrap） |
| GET | `{prefix}/sessions/:sessionId/messages` | 200 | 历史事件 |
| POST | `{prefix}/sessions/:sessionId/messages` | 202 | 发送 / 调度消息 |
| GET | `{prefix}/sessions/:sessionId/runtime` | 200 | 运行态快照 |
| GET | `{prefix}/sessions/:sessionId/stream` | 200 | SSE 长连接 |
| POST | `{prefix}/sessions/:sessionId/turns/:turnId/steer` | 200 | Mid-turn 引导 |
| POST | `{prefix}/sessions/:sessionId/turns/:turnId/interrupt` | 200 | 中断 turn |
| DELETE | `{prefix}/sessions/:sessionId/runtime/queue/:inputId` | 200 | 移除排队输入 |
| POST | `{prefix}/sessions/:sessionId/files` | 201 | 上传图片（Bootstrap，multipart） |
| GET | `{prefix}/files/:fileId/preview` | 200 | 内联预览文件（Bootstrap） |
| GET | `{prefix}/files/:fileId/download` | 200 | 下载文件（Bootstrap） |

### 通用错误

| 状态码 | 场景 |
|--------|------|
| 401 | `{ "error": "Unauthorized" }` — 认证失败 |
| 404 | 会话 / 文件不存在或无权访问 |
| 4xx | Zod 校验失败或业务错误（message 为字符串） |

---

## 会话

### `GET {prefix}/sessions`

返回当前用户的会话列表，按 `updatedAt` 降序。

**响应 `200`**

```json
{
  "sessions": [
    {
      "id": "abc123",
      "title": "新会话",
      "createdAt": "2026-06-28T10:00:00.000Z",
      "updatedAt": "2026-06-28T10:05:00.000Z",
      "lastMessageAt": null,
      "activeSkills": [],
      "metadata": {}
    }
  ]
}
```

### `POST {prefix}/sessions`

**请求体**（均可选）

```json
{
  "title": "我的会话",
  "activeSkills": ["skill-id"],
  "metadata": { "source": "web" }
}
```

| 字段 | 类型 | 约束 |
|------|------|------|
| `title` | `string` | 1–200 字符；省略时默认「新会话」 |
| `activeSkills` | `string[]` | Skill ID 列表 |
| `metadata` | `Record<string, unknown>` | 应用自定义元数据 |

**响应 `201`**

```json
{
  "session": { /* SessionSummary */ }
}
```

---

## 消息

### `GET {prefix}/sessions/:sessionId/messages`

读取 append-only 事件日志（权威历史）。

**Query**

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | `number` | 1–500，可选 |
| `after` | `string` | 事件 ID，返回之后的事件 |
| `before` | `string` | 事件 ID，返回之前的事件 |

**响应 `200`**

```json
{
  "events": [ /* StoredEvent[] */ ]
}
```

### `POST {prefix}/sessions/:sessionId/messages`

发送用户消息并调度 turn。默认异步执行；`HARNESSKIT_INLINE_JOBS=true` 时服务端会 await turn 完成后再返回。

**请求体**

```json
{
  "content": "你好",
  "attachmentIds": ["file_abc"],
  "dispatch": "auto",
  "turnId": "turn_xyz",
  "kind": "regular",
  "turnConfig": {
    "model": "gpt-5.4",
    "reasoningEffort": "medium",
    "maxOutputTokens": 4096,
    "webSearchMode": "live"
  }
}
```

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `content` | `string` | — | **必填**，非空 |
| `attachmentIds` | `string[]` | — | 附件文件 ID |
| `dispatch` | `MessageDispatchMode` | `auto` | 见 [调度模式](#调度模式) |
| `turnId` | `string` | — | `steer` 时指定目标 turn |
| `kind` | `TurnKind` | `regular` | `regular` \| `review` \| `compact` \| `maintenance` |
| `turnConfig` | `TurnConfig` | — | 单轮 LLM 覆盖项 |

**响应 `202`**

```json
{
  "accepted": true,
  "dispatch": "turn_started",
  "messageId": "evt_xxx",
  "runId": "run_xxx",
  "turnId": "turn_xxx",
  "inputId": "inp_xxx",
  "runtime": { /* SessionRuntimeSnapshot */ }
}
```

`dispatch` 返回值：

| 值 | 含义 |
|----|------|
| `turn_started` | 新 turn 已启动 |
| `steer_accepted` | Mid-turn 引导已接受 |
| `queued` | 已加入 follow-up 队列 |

---

## 运行态

### `GET {prefix}/sessions/:sessionId/runtime`

获取 turn 状态、排队输入、恢复信息与 token 统计。

**响应 `200`**

```json
{
  "runtime": {
    "sessionId": "abc123",
    "activeTurn": {
      "turnId": "turn_xxx",
      "kind": "regular",
      "status": "running",
      "phase": "streaming_assistant",
      "phaseStartedAt": "2026-06-28T10:00:01.000Z",
      "canSteer": true,
      "startedAt": "2026-06-28T10:00:00.000Z",
      "round": 1
    },
    "followUpQueue": [
      {
        "inputId": "inp_yyy",
        "content": "稍后处理的话题",
        "createdAt": "2026-06-28T10:00:02.000Z"
      }
    ],
    "recovery": null,
    "tokenUsage": {
      "totalInputTokens": 1200,
      "totalOutputTokens": 800,
      "totalTokens": 2000,
      "turnCount": 3,
      "lastUpdatedAt": "2026-06-28T10:05:00.000Z"
    }
  }
}
```

#### `activeTurn.status`

`running` · `interrupting` · `completed` · `failed` · `interrupted`

#### `activeTurn.phase`

`sampling` · `tool_call` · `waiting_tool_result` · `streaming_assistant` · `finalizing` · `non_steerable`

---

## Turn 控制

### `POST {prefix}/sessions/:sessionId/turns/:turnId/steer`

在 turn 可 steer 时追加用户输入（等价于 `dispatch: 'steer'`）。

**请求体**

```json
{
  "content": "补充说明",
  "attachmentIds": []
}
```

**响应 `200`** — 同 `MessageDispatchResponse`。

### `POST {prefix}/sessions/:sessionId/turns/:turnId/interrupt`

请求中断当前 turn。

**请求体** — 空对象 `{}` 或无 body。

**响应 `200`**

```json
{
  "accepted": true,
  "turnId": "turn_xxx",
  "runtime": { /* SessionRuntimeSnapshot */ }
}
```

### `DELETE {prefix}/sessions/:sessionId/runtime/queue/:inputId`

从 follow-up 队列移除指定输入。

**响应 `200`**

```json
{
  "accepted": true,
  "inputId": "inp_yyy",
  "runtime": { /* SessionRuntimeSnapshot */ }
}
```

---

## 文件（Bootstrap）

### `POST {prefix}/sessions/:sessionId/files`

上传附件（`multipart/form-data`，字段名 `file`）。支持图片及常见数据文件（如 csv、zip、har、json、pdf 等）；禁止可执行文件。

**响应 `201`**

```json
{ "file": { /* FileRecord */ } }
```

### `GET {prefix}/files/:fileId/preview`

内联返回文件内容（`Content-Disposition: inline`），用于图片预览等。

### `GET {prefix}/files/:fileId/download`

附件下载（`Content-Disposition: attachment`）。

> 上传使用 `POST .../sessions/:sessionId/files`（multipart）；`attachmentIds` 引用返回的 `file.id`。

---

## SSE 流

### `GET {prefix}/sessions/:sessionId/stream`

建立 Server-Sent Events 长连接。

**响应头**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**帧格式**

```
id: evt_abc123
event: text_delta
data: {"content":"你好"}

```

| 字段 | 说明 |
|------|------|
| `id` | 事件唯一 ID |
| `event` | 事件名（见下表） |
| `data` | JSON 字符串 |

### 重连约定

StreamHub **不缓冲**断线期间的事件。客户端重连后必须：

1. `GET .../messages` — 拉取完整历史
2. `GET .../runtime` — 拉取运行态
3. 合并 timeline 后再订阅 SSE

`@harnesskit/react` 的 `useSessionStream` 已内置此逻辑。

---

## SSE 事件

稳定契约定义于 `SSE_EVENT_NAMES`（`@harnesskit/protocol`）。Breaking 变更需 major version bump。

### 生命周期

| 事件 | `data` 类型 | 说明 |
|------|-------------|------|
| `turn_started` | `TurnLifecyclePayload` | Turn 开始 |
| `turn_status` | `TurnLifecyclePayload` | Phase / steer 能力变化 |
| `user_message_committed` | `UserMessageCommittedPayload` | 用户输入已提交 |
| `turn_completed` | `TurnCompletedPayload` | Turn 结束 |
| `done` | `{}` | 本轮流式输出结束（可开始下一轮 UI 状态） |
| `error` | `ErrorPayload` | 错误；通常伴随持久化的 `error` 事件 |

#### `TurnLifecyclePayload`

```typescript
{
  turnId: string;
  kind: TurnKind;
  status: TurnStatus;
  phase: TurnPhase;
  phaseStartedAt: string;
  canSteer: boolean;
  startedAt?: string;
  round: number;
  followUpQueueCount: number;
}
```

#### `TurnCompletedPayload`

```typescript
{ turnId: string; kind: TurnKind; status: TurnStatus }
```

#### `UserMessageCommittedPayload`

```typescript
{
  turnId: string;
  inputId: string;
  content: string;
  createdAt: string;
  consumedInputIds?: string[];
  attachments?: FileRecord[];
}
```

### 文本与推理

| 事件 | `data` | 说明 |
|------|--------|------|
| `text_delta` | `{ content: string }` | Assistant 可见文本增量 |
| `reasoning_delta` | `{ content: string; segmentId?: string }` | 推理过程增量（UI 可选展示） |
| `reasoning_segment` | `{ id: string; content: string }` | 推理段落落盘后的通知 |
| `thinking` | `{ message: string }` | 状态提示（如「正在分析需求」） |
| `assistant_message_committed` | `{ message: TextMessageEvent }` | Assistant 文本消息已持久化 |
| `token_count` | `TokenCountPayload` | 当前轮 token 用量 |

#### `TokenCountPayload`

```typescript
{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cumulativeInputTokens?: number;
  cumulativeOutputTokens?: number;
  cumulativeTotalTokens?: number;
}
```

### 工具

| 事件 | `data` | 说明 |
|------|--------|------|
| `tool_start` | 见下 | 工具调用开始 |
| `tool_progress` | 见下 | 工具执行进度 |
| `tool_result` | 见下 | 工具返回结果 |

`tool_start` / `tool_progress` / `tool_result` 的 `skill` 字段为对象：

```typescript
{ name: string; status: string }  // status 如 'running' | 'success'
```

`tool_start` 额外含 `callId`、`arguments`、`meta`。

`tool_progress` 额外含 `message`、`percent?`、`meta`。

`tool_result` 额外含 `message`、`content?`、`meta`。

> `hidden: true` 的工具事件会持久化但**不**通过 SSE 广播。

### 文件

| 事件 | `data` | 说明 |
|------|--------|------|
| `file_ready` | `{ file: { id, name, size, url? } }` | 生成文件或附件就绪 |

---

## 数据模型

### `StoredEvent`（消息事件联合类型）

持久化在 `messages` 端点返回的 `events` 数组中。`kind` 判别：

| `kind` | 用途 |
|--------|------|
| `message` | 用户 / assistant / system 文本 |
| `thinking` | 思考内容（持久化） |
| `reasoning_segment` | 推理段落 |
| `tool_call` | 工具调用 |
| `tool_progress` | 工具进度 |
| `tool_result` | 工具结果 |
| `image` | 生图结果 |
| `file` | 文件附件 |
| `error` | 错误消息 |

完整字段见 `@harnesskit/protocol` 的 `types.ts`。

#### `TextMessageEvent` 示例

```json
{
  "id": "evt_xxx",
  "sessionId": "abc123",
  "kind": "message",
  "role": "assistant",
  "type": "text",
  "content": "你好！",
  "createdAt": "2026-06-28T10:00:05.000Z",
  "meta": {
    "turnId": "turn_xxx",
    "durationMs": 3200,
    "tokenUsage": { "inputTokens": 100, "outputTokens": 50, "totalTokens": 150 }
  }
}
```

### `SessionSummary`

```typescript
{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  activeSkills: string[];
  metadata?: Record<string, unknown>;
}
```

### `ChatUser`（认证解析结果）

```typescript
{ id: string; username: string; role?: 'admin' | 'member' }
```

---

## 调度模式

`dispatch` 字段控制消息如何进入 Turn 运行时：

| 模式 | 行为 |
|------|------|
| `auto` | **默认**。当前 turn 可 steer → `steer`；否则 → `queue_next` |
| `new_turn` | 强制开启新 turn（当前有活跃 turn 时先入队） |
| `steer` | Mid-turn 引导；需 `canSteer === true` |
| `queue_next` | 加入 follow-up 队列，当前 turn 结束后处理 |

---

## TypeScript 导入

```typescript
import {
  SSE_EVENT_NAMES,
  DISPATCH_MODES,
  TURN_STATUSES,
  TURN_PHASES,
  createMessageSchema,
  createSessionSchema,
  steerMessageSchema,
} from '@harnesskit/protocol';

import type {
  StoredEvent,
  SessionSummary,
  SessionRuntimeSnapshot,
  MessageDispatchResponse,
  MessageDispatchMode,
  SSEEventName,
  TurnLifecyclePayload,
  TextDeltaPayload,
} from '@harnesskit/protocol';
```

Zod schema 可用于客户端请求校验；服务端路由已内置相同 schema。

---

## 自定义客户端示例

```typescript
import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { SSEEventName, TextDeltaPayload } from '@harnesskit/protocol';

// 1. 建立 SSE
await fetchEventSource('/api/chat/sessions/s1/stream', {
  credentials: 'include',
  onmessage(ev) {
    const name = ev.event as SSEEventName;
    const data = JSON.parse(ev.data);

    switch (name) {
      case 'text_delta':
        appendText((data as TextDeltaPayload).content);
        break;
      case 'assistant_message_committed':
        clearPendingText();
        break;
      case 'turn_completed':
      case 'done':
        refetchMessagesAndRuntime();
        break;
      case 'error':
        showError(data.message);
        break;
    }
  },
});

// 2. 发送消息
const res = await fetch('/api/chat/sessions/s1/messages', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: '你好', dispatch: 'auto' }),
});
const dispatch: MessageDispatchResponse = await res.json();
```
