# Chat Frontend — Design

**Date:** 2026-07-04
**Status:** Approved
**Scope:** A minimal chat UI in the Angular frontend (`apps/frontend`) that talks to the existing Nest endpoint `POST /api/agent/messages`. No extra features — send a message, show the reply, keep the session.

## Context

- Backend contract already exists ([agent.dto.ts](../../../apps/api/src/app/agent.dto.ts)): request `{ message: string, sessionId?: string }`, response `{ sessionId: string, text: string }`. Plain request/response — no streaming to the browser.
- The Nest app serves under global prefix `api` on port 3000.
- The frontend has a complete design-token system (`styles/tokens/_primitives.scss`, `_semantic.scss`) and a mandatory accessibility base layer (skip-link, `:focus-visible`, reduced-motion, `.sr-only`). Components consume **semantic tokens only** — no raw hex values.
- Dev wiring follows the day5 workshop repo pattern: NX dev-server proxy, not CORS.

## Architecture

### 1. Dev proxy
- `apps/frontend/proxy.conf.json`: `/api` → `http://localhost:3000` (`secure: false`, `changeOrigin: true`).
- `apps/frontend/project.json` serve target gets `"options": { "proxyConfig": "apps/frontend/proxy.conf.json" }`.
- Frontend code calls the relative path `/api/agent/messages` — no environment files, no hardcoded hosts.

### 2. HttpClient
- `app.config.ts` adds `provideHttpClient(withFetch())`.

### 3. ChatService — `app/chat/chat.service.ts`
Owns all chat state as signals:

| Signal | Type | Purpose |
|---|---|---|
| `messages` | `ChatMessage[]` | `{ role: 'user' \| 'assistant', text: string }` in order |
| `pending` | `boolean` | request in flight; disables send, shows thinking indicator |
| `error` | `string \| null` | last failure message; cleared on next send |

Private `sessionId: string | null` — sent with each request when known, updated from every response.

One public method: `send(text: string)`. Trims input, ignores empty. Appends the user message optimistically, POSTs, appends the assistant reply on success. On HTTP error: sets `error` to a human-readable message, keeps the user's message visible in the list, `pending` back to false.

### 4. ChatPage — `app/chat/chat-page.ts` (+ `.html`, `.scss`)
Single view component (standalone, `ChangeDetectionStrategy.OnPush`), rendered directly by `App` (the `nx-welcome` placeholder is removed). Layout:

- `header` — app title bar.
- `main#main-content` — scrollable message region.
- Composer pinned at the bottom — auto-growing `textarea` + send button.

Behavior:
- Enter sends; Shift+Enter inserts a newline.
- While `pending`: send button disabled, three-dot thinking indicator shown as an assistant-side bubble.
- New messages scroll the log to the bottom.
- After sending, focus returns to the textarea.

## Visual design (tokens only)

| Element | Tokens |
|---|---|
| Page canvas | `--color-surface` |
| User bubble (right-aligned) | `--color-primary` bg, `--color-on-primary` text, `--radius-lg` |
| Assistant bubble (left-aligned) | `--color-surface-raised` bg, `--color-border` border, `--color-text-primary` text |
| Header | `--color-surface-raised`, `--color-border` bottom border, `--font-weight-semibold` |
| Composer | `--color-surface-raised`, `--color-border-strong` on focus-within |
| Error notice | `--color-error-50` bg, `--color-error-700` text |
| Spacing / type | `--space-*` 4px grid, `--font-size-md/base`, `--line-height-normal` |
| Motion | thinking dots use `--duration-slow`; silenced by the global reduced-motion rule |

## Accessibility

- Skip-link (`.skip-link`, already styled globally) as the first focusable element, targeting `#main-content`.
- Landmarks: `header`, `main`.
- Message list: `role="log"` + `aria-live="polite"` so screen readers announce assistant replies; each bubble carries a visually-hidden role prefix ("You" / "Assistant") via `.sr-only`.
- Textarea labelled with a `.sr-only` `<label>`.
- Error rendered with `role="alert"`.
- Focus: returns to textarea after send; visible focus ring comes from the global `:focus-visible` rule.
- Color contrast inherited from the verified token pairs (see `_semantic.scss` header comment).

## Error handling

- Non-2xx / network failure → `error` signal set to a short message ("Something went wrong — try again."), shown as an alert above the composer. The failed user message stays in the log; the user can re-type or resend.
- Empty/whitespace input is ignored client-side (backend also rejects with 400).

## Testing

- `ChatService` unit tests via `HttpTestingController`: sends correct payload, stores `sessionId` and includes it on the next request, appends assistant reply, sets `error` and clears `pending` on failure.
- View verified manually in the browser against the running Nest API.

## Out of scope

- Streaming responses, markdown rendering, message persistence, multiple conversations, dark mode, authentication.
