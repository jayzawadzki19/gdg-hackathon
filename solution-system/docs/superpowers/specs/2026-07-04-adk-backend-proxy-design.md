# ADK Backend Proxy Design

## Context

The solution currently runs three relevant pieces:

- `apps/api` is a Nest backend with only the default `GET /api` endpoint.
- `adg-agents/agent.ts` exports an ADK `rootAgent` and is served separately by `adk api_server agent.ts`.
- `mcp-server` exposes TRIZ tools over Streamable HTTP for the agent to consume.

The desired boundary is to keep the ADK agent as a separate service and make the Nest backend the only client-facing proxy for agent interactions.

## Goals

Expose a small backend API for sending user messages to the ADK agent.

Hide ADK-specific session and run endpoints from frontend or external callers.

Keep the proxy implementation isolated, testable, and configurable for local development and Docker Compose.

Preserve the existing ADK agent service and MCP server architecture.

## Non-Goals

Do not move the ADK agent into the Nest process.

Do not build a generic reverse proxy for every ADK endpoint.

Do not change TRIZ MCP tools or the agent's tool registration as part of this change.

Do not implement authentication, persistence, or rate limiting yet.

## Proposed API

Add a targeted endpoint in the Nest backend:

```http
POST /api/agent/messages
Content-Type: application/json
```

Request body:

```json
{
  "message": "How can I reduce API latency without increasing infrastructure cost?",
  "sessionId": "optional-existing-session-id"
}
```

Response body:

```json
{
  "sessionId": "adk-session-id",
  "text": "Agent response text"
}
```

If `sessionId` is omitted, the backend creates an ADK session before running the message.

## Components

`AgentController` handles the HTTP contract and delegates all ADK interaction to a service.

`AgentService` owns ADK service-to-service calls:

- Build ADK base URL from `ADK_AGENT_URL`, defaulting to `http://localhost:8081`.
- Create sessions through `POST /apps/agent/users/user/sessions`.
- Send messages through `POST /run_sse`.
- Parse the SSE/event stream and return the final model text.
- Convert ADK/network failures into Nest HTTP exceptions.

Small DTOs define the public request and response shapes.

## ADK Interaction

The proxy will use the ADK API shape observed from the local ADK server logs:

- `POST /apps/agent/users/user/sessions` creates a session.
- `POST /run_sse` runs the agent against that session.

The run payload should include:

```json
{
  "appName": "agent",
  "userId": "user",
  "sessionId": "session-id",
  "newMessage": {
    "role": "user",
    "parts": [{ "text": "user message" }]
  }
}
```

The backend should parse returned events and select the latest model event with `content.parts[].text`.

## Configuration

Add an API container to `docker-compose.yml` and wire service URLs:

- `api` listens on `3000`.
- `api` receives `ADK_AGENT_URL=http://adk-agent:8081`.
- `adk-agent` receives `MCP_SERVER_URL=http://mcp-server:8000/mcp`.

The ADK service remains exposed on `8081` for local debugging, but normal client traffic should go through the Nest API.

## Error Handling

Invalid or empty `message` returns `400`.

ADK session creation failures return `502`.

ADK run failures or malformed event streams return `502`.

Unexpected backend errors return the normal Nest `500`.

Errors should avoid leaking API keys or raw upstream internals.

## Testing

Add focused Nest unit tests for:

- Controller delegates valid message requests to `AgentService`.
- Service creates a session when no `sessionId` is provided.
- Service reuses a provided `sessionId`.
- Service extracts model text from ADK event stream data.
- Service maps upstream failures to `BadGatewayException`.

Manual verification:

```sh
bun nx test api
bun nx build api
docker compose up --build
curl -X POST http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"Suggest a TRIZ approach for improving latency without increasing cost"}'
```

## Implementation Notes

Use existing dependencies first. The workspace already has `axios`, so the service can use it directly instead of introducing a new HTTP client package.

Keep the initial route synchronous and JSON-based. Streaming can be added later if the UI needs token-level updates.

Keep `GET /api` unchanged unless it interferes with tests.
