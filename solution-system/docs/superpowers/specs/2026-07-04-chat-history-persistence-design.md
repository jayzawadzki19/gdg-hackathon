# Chat History Persistence — Design

**Date:** 2026-07-04
**Status:** Approved
**Scope:** Add Postgres-backed chat history to `apps/api` and update the Angular chat UI so a single demo user can create chats, switch between chats, and resume previous conversations.

## Context

The current API exposes `POST /api/agent/messages` through `AgentController`. `AgentService` validates the message, creates or reuses an ADK `sessionId`, calls `POST {ADK_AGENT_URL}/run_sse`, extracts the latest non-user model text, and returns `{ sessionId, text }`.

The current frontend keeps one in-memory `sessionId` and an in-memory `ChatMessage[]` signal. Refreshing the browser loses the conversation, and there is no API contract for listing chats, loading prior messages, creating a new chat, or switching between conversations.

The day4 reference API uses NestJS + Sequelize + Postgres with `SequelizeModule.forRoot(...)`, feature modules with `SequelizeModule.forFeature([...])`, and services that inject models using `@InjectModel(...)`. The chat persistence implementation should follow that pattern.

## Architecture

### Database

`docker-compose.yml` adds a `postgres` service and makes `api` depend on it. The API receives database settings through environment variables:

```text
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=solution_system
```

`AppModule` registers `SequelizeModule.forRoot(...)` with dialect `postgres`, environment-based settings, and the chat models. For this hackathon app, `synchronize: true` is acceptable so the schema is created automatically in local Docker. Production migrations stay out of scope.

### Models

`Chat` represents a conversation thread.

| Field | Type | Notes |
|---|---|---|
| `id` | integer primary key | Local app chat id used by the frontend |
| `adkSessionId` | string unique | Session id used when calling ADK |
| `userId` | string | Fixed to `"user"` for now |
| `title` | string | Derived from the first user message, fallback `"New chat"` |
| `createdAt` | date | Managed by Sequelize |
| `updatedAt` | date | Managed by Sequelize |

`ChatMessage` represents one persisted message.

| Field | Type | Notes |
|---|---|---|
| `id` | integer primary key | Local message id |
| `chatId` | integer foreign key | Belongs to `Chat` |
| `role` | enum/string | `"user"` or `"assistant"` |
| `text` | text | Full message content |
| `createdAt` | date | Used for stable ordering |
| `updatedAt` | date | Managed by Sequelize |

Relationships:

```text
Chat hasMany ChatMessage
ChatMessage belongsTo Chat
```

## API Contract

The persistence API lives under a new `ChatModule`.

```text
GET  /api/chats
POST /api/chats
GET  /api/chats/:chatId
POST /api/chats/:chatId/messages
```

`GET /api/chats` returns lightweight chat summaries for the fixed demo user, ordered by newest update first:

```json
[
  {
    "id": 1,
    "title": "Explain TRIZ contradiction",
    "createdAt": "2026-07-04T10:00:00.000Z",
    "updatedAt": "2026-07-04T10:05:00.000Z"
  }
]
```

`POST /api/chats` creates an ADK session, stores a `Chat` row with title `"New chat"`, and returns the created summary. This supports an empty new chat before the first message is sent.

`GET /api/chats/:chatId` returns the chat plus ordered messages:

```json
{
  "id": 1,
  "title": "Explain TRIZ contradiction",
  "createdAt": "2026-07-04T10:00:00.000Z",
  "updatedAt": "2026-07-04T10:05:00.000Z",
  "messages": [
    { "id": 1, "role": "user", "text": "Explain TRIZ contradiction" },
    { "id": 2, "role": "assistant", "text": "A contradiction is..." }
  ]
}
```

`POST /api/chats/:chatId/messages` accepts:

```json
{
  "message": "Continue"
}
```

It loads the chat, sends the message to ADK using the stored `adkSessionId`, extracts the assistant reply, and persists both rows in one database transaction. The same transaction updates `Chat.updatedAt`; if the chat title is still `"New chat"`, it derives the title from the first user message. It returns the updated chat id, title, and both persisted messages:

```json
{
  "chatId": 1,
  "title": "Explain TRIZ contradiction",
  "messages": [
    { "id": 3, "role": "user", "text": "Continue" },
    { "id": 4, "role": "assistant", "text": "Sure..." }
  ]
}
```

The existing `POST /api/agent/messages` remains available for compatibility. The frontend stops using it and moves to the chat routes.

## Data Flow

On app load, the frontend calls `GET /api/chats`. If chats exist, it selects the newest chat and calls `GET /api/chats/:chatId`. If no chats exist, it can show an empty state and create a chat when the user clicks "New chat" or sends the first message.

When the user creates a new chat, the frontend calls `POST /api/chats`, adds the returned summary to the list, selects it, and clears the message log.

When the user switches chats, the frontend sets the selected chat id, loads `GET /api/chats/:chatId`, and replaces the local message signal with the persisted messages.

When the user sends a message, the frontend optimistically appends the user message, calls `POST /api/chats/:chatId/messages`, then reconciles with the persisted user and assistant messages returned by the API. If the response changes the chat title from `"New chat"` to a first-message title, the frontend updates the selected summary. If no chat is selected, the frontend first creates a chat, then sends the message to that chat.

## Frontend Changes

`ChatService` becomes the owner of:

| State | Purpose |
|---|---|
| `chats` | Chat summaries for the sidebar |
| `selectedChatId` | Currently open chat |
| `messages` | Messages for the selected chat |
| `pending` | Send or load operation in progress |
| `error` | User-facing failure message |

Public methods:

```text
loadChats()
createChat()
selectChat(chatId)
send(text)
```

`ChatPage` adds a sidebar with chat summaries and a "New chat" action. The main panel keeps the existing message log and composer behavior, including Enter-to-send, Shift+Enter newline, focus return, and pending indicator.

## Error Handling

Whitespace-only messages are rejected before any ADK or database work.

If the requested chat does not exist for the demo user, the API returns `404 Not Found`.

If ADK session creation or message execution fails, the API returns `BadGatewayException`. The message pair is not persisted as completed, so reloading the chat does not show a user message that ADK never answered.

If database persistence fails after ADK returns, the API returns an error and the frontend shows a retry message. The frontend keeps optimistic UI local only until the next reload; persisted history remains the source of truth.

## Testing

API tests:

- `ChatService.createChat()` creates an ADK session and a DB chat.
- `ChatService.listChats()` returns newest chats first.
- `ChatService.getChat()` returns ordered messages.
- `ChatService.sendMessage()` rejects empty input.
- `ChatService.sendMessage()` persists user and assistant messages for an existing chat.
- `ChatService.sendMessage()` maps missing chats to `NotFoundException`.
- `ChatService.sendMessage()` maps ADK failures to `BadGatewayException` and does not create message rows.

Frontend tests:

- `ChatService.loadChats()` populates summaries and loads the selected chat.
- `ChatService.createChat()` adds and selects a new chat.
- `ChatService.selectChat()` replaces messages with loaded history.
- `ChatService.send()` creates a chat first when none is selected.
- `ChatService.send()` posts to the selected chat and appends the assistant reply.
- Send failure sets `error` and clears `pending`.

## Out of Scope

Authentication, multi-user UI, production migrations, full-text search, chat deletion, chat renaming, streaming browser responses, markdown rendering, and preserving failed user-only messages are out of scope for this change.
