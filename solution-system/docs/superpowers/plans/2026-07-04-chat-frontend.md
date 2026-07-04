# Chat Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A minimal chat view in `apps/frontend` that talks to the existing Nest endpoint `POST /api/agent/messages` and keeps the conversation session.

**Architecture:** One signal-based `ChatService` owns all state (messages, pending, error, sessionId) and performs the HTTP call. One standalone `ChatPage` component renders the log + composer, consuming design-system semantic tokens only. Dev traffic reaches Nest through the NX dev-server proxy (`/api` → `localhost:3000`) — no CORS, no env files.

**Tech Stack:** Angular 21.2 (standalone, signals, zoneless), SCSS with the existing token system, NX. Tests run via `@angular/build:unit-test` (vitest runner, jasmine-style API) with `HttpTestingController`.

**Spec:** `docs/superpowers/specs/2026-07-04-chat-frontend-design.md`

## Global Constraints

- All commands run from the repo root: `/Users/jakubzawadzki/Desktop/Dev/Projects/GDG_Hackathon/gdg-hackathon/solution-system`.
- **Do NOT create git commits.** The user manages commits themselves.
- Component styles consume **semantic tokens only** (`--color-*`, `--space-*`, `--radius-*`, `--font-*`, `--duration-*`, `--ease-*`, `--shadow-*`). No raw hex values, no direct primitive-scale references (`--color-error-50` etc.) in component SCSS — if a semantic role is missing, add it to `apps/frontend/src/styles/tokens/_semantic.scss`.
- UI copy is English, sentence case.
- The frontend calls the relative path `/api/agent/messages` — never a hardcoded host.
- Backend contract (already implemented, do not change): request `{ message: string, sessionId?: string }`, response `{ sessionId: string, text: string }`.

---

### Task 1: ChatService — state + HTTP

**Files:**
- Create: `apps/frontend/src/app/chat/chat.types.ts`
- Create: `apps/frontend/src/app/chat/chat.service.ts`
- Create: `apps/frontend/src/app/chat/chat.service.spec.ts`
- Modify: `apps/frontend/src/app/app.config.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `ChatService` (root-provided) with readonly signals `messages(): ChatMessage[]`, `pending(): boolean`, `error(): string | null`, and method `send(text: string): Promise<void>`. Type `ChatMessage = { role: 'user' | 'assistant'; text: string }` from `chat.types.ts`. Task 2 consumes exactly these.

- [ ] **Step 1: Create the shared types**

`apps/frontend/src/app/chat/chat.types.ts`:

```ts
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

// Mirrors apps/api/src/app/agent.dto.ts — keep in sync manually.
export interface AgentMessageRequest {
  message: string;
  sessionId?: string;
}

export interface AgentMessageResponse {
  sessionId: string;
  text: string;
}
```

- [ ] **Step 2: Write the failing tests**

`apps/frontend/src/app/chat/chat.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends the message and appends the assistant reply', async () => {
    const sendPromise = service.send('Hello');

    // User message appears optimistically, before the response arrives.
    expect(service.messages()).toEqual([{ role: 'user', text: 'Hello' }]);
    expect(service.pending()).toBe(true);

    const req = httpMock.expectOne('/api/agent/messages');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Hello' });
    req.flush({ sessionId: 's-1', text: 'Hi there' });
    await sendPromise;

    expect(service.messages()).toEqual([
      { role: 'user', text: 'Hello' },
      { role: 'assistant', text: 'Hi there' },
    ]);
    expect(service.pending()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('includes the stored sessionId on subsequent sends', async () => {
    const first = service.send('First');
    httpMock
      .expectOne('/api/agent/messages')
      .flush({ sessionId: 's-1', text: 'Reply 1' });
    await first;

    const second = service.send('Second');
    const req = httpMock.expectOne('/api/agent/messages');
    expect(req.request.body).toEqual({ message: 'Second', sessionId: 's-1' });
    req.flush({ sessionId: 's-1', text: 'Reply 2' });
    await second;
  });

  it('sets an error and keeps the user message when the request fails', async () => {
    const sendPromise = service.send('Hello');
    httpMock
      .expectOne('/api/agent/messages')
      .flush('boom', { status: 502, statusText: 'Bad Gateway' });
    await sendPromise;

    expect(service.messages()).toEqual([{ role: 'user', text: 'Hello' }]);
    expect(service.error()).toBe('Something went wrong — try again.');
    expect(service.pending()).toBe(false);
  });

  it('clears the previous error on the next send', async () => {
    const failed = service.send('Hello');
    httpMock
      .expectOne('/api/agent/messages')
      .flush('boom', { status: 502, statusText: 'Bad Gateway' });
    await failed;
    expect(service.error()).not.toBeNull();

    const retry = service.send('Hello again');
    expect(service.error()).toBeNull();
    httpMock
      .expectOne('/api/agent/messages')
      .flush({ sessionId: 's-1', text: 'Hi' });
    await retry;
  });

  it('ignores empty input', async () => {
    await service.send('   ');
    httpMock.expectNone('/api/agent/messages');
    expect(service.messages()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx nx test frontend`
Expected: FAIL — cannot resolve `./chat.service` (module does not exist yet).

- [ ] **Step 4: Implement ChatService**

`apps/frontend/src/app/chat/chat.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AgentMessageRequest,
  AgentMessageResponse,
  ChatMessage,
} from './chat.types';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);

  private readonly messagesState = signal<ChatMessage[]>([]);
  private readonly pendingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private sessionId: string | null = null;

  readonly messages = this.messagesState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.pendingState()) {
      return;
    }

    this.errorState.set(null);
    this.pendingState.set(true);
    this.messagesState.update((messages) => [
      ...messages,
      { role: 'user', text: message },
    ]);

    const request: AgentMessageRequest = this.sessionId
      ? { message, sessionId: this.sessionId }
      : { message };

    try {
      const response = await firstValueFrom(
        this.http.post<AgentMessageResponse>('/api/agent/messages', request),
      );
      this.sessionId = response.sessionId;
      this.messagesState.update((messages) => [
        ...messages,
        { role: 'assistant', text: response.text },
      ]);
    } catch {
      this.errorState.set('Something went wrong — try again.');
    } finally {
      this.pendingState.set(false);
    }
  }
}
```

- [ ] **Step 5: Provide HttpClient at the app level**

Replace the full contents of `apps/frontend/src/app/app.config.ts`:

```ts
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
  ],
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx nx test frontend`
Expected: all `ChatService` tests PASS. (The pre-existing `App` spec still passes — it is untouched until Task 3.)

---

### Task 2: ChatPage component + error-subtle semantic tokens

**Files:**
- Modify: `apps/frontend/src/styles/tokens/_semantic.scss` (status section, lines 40–48)
- Create: `apps/frontend/src/app/chat/chat-page.ts`
- Create: `apps/frontend/src/app/chat/chat-page.html`
- Create: `apps/frontend/src/app/chat/chat-page.scss`

**Interfaces:**
- Consumes: `ChatService` from Task 1 — signals `messages()`, `pending()`, `error()`; method `send(text: string): Promise<void>`.
- Produces: standalone component `ChatPage`, selector `app-chat-page`, exported from `apps/frontend/src/app/chat/chat-page.ts`. Its template contains `<main id="main-content">` (skip-link target) and an `<h1>` with text `Solution system`. Task 3 consumes exactly these.

- [ ] **Step 1: Add the subtle-error semantic pair**

The spec's error notice needs a subtle (light) error surface, which the semantic tier does not yet name. In `apps/frontend/src/styles/tokens/_semantic.scss`, extend the status block. Replace:

```scss
  // ---- Status (backgrounds pair with the on-* foreground) ----
  --color-success: var(--color-success-600);
  --color-on-success: #ffffff;
  --color-warning: var(--color-warning-500);
  --color-on-warning: var(--color-neutral-900);
  --color-error: var(--color-error-600);
  --color-on-error: #ffffff;
  --color-info: var(--color-info-500);
  --color-on-info: #ffffff;
```

with:

```scss
  // ---- Status (backgrounds pair with the on-* foreground) ----
  --color-success: var(--color-success-600);
  --color-on-success: #ffffff;
  --color-warning: var(--color-warning-500);
  --color-on-warning: var(--color-neutral-900);
  --color-error: var(--color-error-600);
  --color-on-error: #ffffff;
  --color-error-subtle: var(--color-error-50);
  --color-on-error-subtle: var(--color-error-700); // 7.6:1 on error-50 — AA pass
  --color-info: var(--color-info-500);
  --color-on-info: #ffffff;
```

- [ ] **Step 2: Create the component class**

`apps/frontend/src/app/chat/chat-page.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { ChatService } from './chat.service';

@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  private readonly logRef =
    viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly inputRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  constructor() {
    // Keep the log scrolled to the newest message. Runs after render, so the
    // new bubble is already in the DOM; instant jump (no smooth behavior), so
    // reduced-motion needs no special casing here.
    afterRenderEffect(() => {
      this.chat.messages();
      this.chat.pending();
      const log = this.logRef().nativeElement;
      log.scrollTo({ top: log.scrollHeight });
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.sendCurrent();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Enter sends; Shift+Enter falls through to insert a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendCurrent();
    }
  }

  protected onInput(): void {
    this.resizeInput();
  }

  private sendCurrent(): void {
    const textarea = this.inputRef().nativeElement;
    if (!textarea.value.trim() || this.chat.pending()) {
      return;
    }
    void this.chat.send(textarea.value);
    textarea.value = '';
    this.resizeInput();
    textarea.focus();
  }

  // Auto-grow: collapse, then track content height (capped in CSS).
  private resizeInput(): void {
    const textarea = this.inputRef().nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
```

- [ ] **Step 3: Create the template**

`apps/frontend/src/app/chat/chat-page.html`:

```html
<div class="chat">
  <header class="chat__header">
    <h1 class="chat__title">Solution system</h1>
    <p class="chat__subtitle">Agent chat</p>
  </header>

  <main id="main-content" class="chat__main">
    <div
      #log
      class="chat__log"
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      @if (chat.messages().length === 0 && !chat.pending()) {
        <p class="chat__empty">Ask the agent anything to get started.</p>
      }
      @for (message of chat.messages(); track $index) {
        <article class="chat__message chat__message--{{ message.role }}">
          <span class="sr-only">
            {{ message.role === 'user' ? 'You' : 'Assistant' }}:
          </span>
          <p class="chat__bubble">{{ message.text }}</p>
        </article>
      }
      @if (chat.pending()) {
        <article class="chat__message chat__message--assistant">
          <span class="sr-only">Assistant is typing</span>
          <p class="chat__bubble chat__bubble--thinking" aria-hidden="true">
            <span class="chat__dot"></span>
            <span class="chat__dot"></span>
            <span class="chat__dot"></span>
          </p>
        </article>
      }
    </div>

    @if (chat.error(); as errorText) {
      <p class="chat__error" role="alert">{{ errorText }}</p>
    }

    <form class="chat__composer" (submit)="onSubmit($event)">
      <label class="sr-only" for="chat-input">Message the agent</label>
      <textarea
        #input
        id="chat-input"
        class="chat__input"
        rows="1"
        placeholder="Message the agent…"
        (keydown)="onKeydown($event)"
        (input)="onInput()"
      ></textarea>
      <button class="chat__send" type="submit" [disabled]="chat.pending()">
        Send
      </button>
    </form>
  </main>
</div>
```

- [ ] **Step 4: Create the styles (semantic tokens only)**

`apps/frontend/src/app/chat/chat-page.scss`:

```scss
:host {
  display: block;
  height: 100dvh;
}

.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 48rem;
  margin-inline: auto;
}

.chat__header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface-raised);
  border-bottom: 1px solid var(--color-border);
}

.chat__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.chat__subtitle {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.chat__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0; // allow the log to shrink and scroll
  padding: var(--space-4) var(--space-6) var(--space-6);
}

.chat__log {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  padding-block: var(--space-2);
  overflow-y: auto;
}

.chat__empty {
  margin: auto;
  color: var(--color-text-muted);
}

.chat__message {
  display: flex;
  max-width: 85%;
}

.chat__message--user {
  align-self: flex-end;
}

.chat__message--assistant {
  align-self: flex-start;
}

.chat__bubble {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat__message--user .chat__bubble {
  background: var(--color-primary);
  border-end-end-radius: var(--radius-sm);
  color: var(--color-on-primary);
}

.chat__message--assistant .chat__bubble {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-end-start-radius: var(--radius-sm);
  color: var(--color-text-primary);
}

// Thinking indicator — decorative; the global reduced-motion rule freezes it,
// and pending state is still conveyed by the sr-only text + disabled button.
.chat__bubble--thinking {
  display: inline-flex;
  gap: var(--space-1);
}

.chat__dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-text-muted);
  animation: chat-dot-pulse var(--duration-slow) var(--ease-in-out) infinite
    alternate;
}

.chat__dot:nth-child(2) {
  animation-delay: calc(var(--duration-slow) / 3);
}

.chat__dot:nth-child(3) {
  animation-delay: calc(var(--duration-slow) * 2 / 3);
}

@keyframes chat-dot-pulse {
  from {
    opacity: 0.3;
  }

  to {
    opacity: 1;
  }
}

.chat__error {
  margin: 0;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-error-subtle);
  color: var(--color-on-error-subtle);
  font-size: var(--font-size-md);
}

.chat__composer {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);

  // The textarea's own outline is suppressed below, so the composer as a
  // whole must carry a clearly visible focus indicator.
  &:focus-within {
    outline: 3px solid var(--color-focus-ring);
    outline-offset: 2px;
  }
}

.chat__input {
  flex: 1;
  max-height: 10rem;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  resize: none;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus-visible {
    outline: none; // indicator carried by .chat__composer:focus-within
  }
}

.chat__send {
  min-height: var(--space-10);
  padding: var(--space-2) var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);

  &:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  &:active:not(:disabled) {
    background: var(--color-primary-active);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx nx build frontend --configuration=development`
Expected: build succeeds. (`ChatPage` is not referenced anywhere yet, but the build type-checks and compiles all project sources, catching template/SCSS errors.)

Run: `npx nx test frontend`
Expected: still all PASS (no behavior changed for existing specs).

---

### Task 3: App shell integration + dev proxy + verification

**Files:**
- Create: `apps/frontend/proxy.conf.json`
- Modify: `apps/frontend/project.json` (serve target, lines 53–65)
- Modify: `apps/frontend/src/app/app.ts`
- Modify: `apps/frontend/src/app/app.html`
- Modify: `apps/frontend/src/app/app.spec.ts`
- Modify: `apps/frontend/src/index.html` (title)
- Delete: `apps/frontend/src/app/nx-welcome.ts`

**Interfaces:**
- Consumes: `ChatPage` (selector `app-chat-page`) from Task 2, whose template contains `<main id="main-content">` and `<h1>Solution system</h1>`.
- Produces: the running app — root shell renders skip-link + chat page; dev proxy forwards `/api` to Nest.

- [ ] **Step 1: Update the root App spec (failing first)**

Replace the full contents of `apps/frontend/src/app/app.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('renders the skip link and the chat page', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const skipLink = compiled.querySelector('a.skip-link');
    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(compiled.querySelector('app-chat-page')).toBeTruthy();
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Solution system',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test frontend`
Expected: the `App` spec FAILS (`app-chat-page` not rendered — the shell still shows `NxWelcome`).

- [ ] **Step 3: Rewire the root shell**

Replace the full contents of `apps/frontend/src/app/app.ts`:

```ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChatPage } from './chat/chat-page';

@Component({
  imports: [ChatPage, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

Replace the full contents of `apps/frontend/src/app/app.html` (skip-link must stay the first focusable element in the root template, per `_accessibility.scss`):

```html
<a class="skip-link" href="#main-content">Skip to main content</a>
<app-chat-page />
<router-outlet></router-outlet>
```

Delete `apps/frontend/src/app/nx-welcome.ts`:

```bash
rm apps/frontend/src/app/nx-welcome.ts
```

In `apps/frontend/src/index.html`, replace `<title>frontend</title>` with:

```html
<title>Solution system — agent chat</title>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx test frontend`
Expected: all PASS (App spec + ChatService specs).

- [ ] **Step 5: Add the dev proxy**

Create `apps/frontend/proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

In `apps/frontend/project.json`, add an `options` block to the `serve` target — replace:

```json
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "defaultConfiguration": "development",
      "configurations": {
        "production": {
          "buildTarget": "frontend:build:production"
        },
        "development": {
          "buildTarget": "frontend:build:development"
        }
      }
    },
```

with:

```json
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "defaultConfiguration": "development",
      "options": {
        "proxyConfig": "apps/frontend/proxy.conf.json"
      },
      "configurations": {
        "production": {
          "buildTarget": "frontend:build:production"
        },
        "development": {
          "buildTarget": "frontend:build:development"
        }
      }
    },
```

- [ ] **Step 6: Lint and build**

Run: `npx nx lint frontend`
Expected: PASS (no errors).

Run: `npx nx build frontend --configuration=development`
Expected: build succeeds.

- [ ] **Step 7: Manual verification in the browser**

Start both apps (two terminals, or rely on NX continuous targets):

```bash
npx nx serve api        # Nest on http://localhost:3000/api
npx nx serve frontend   # Angular on http://localhost:4200
```

If the ADK agent is available, start it too (see `docker-compose.yml`; it must listen on `localhost:8081`). Then verify at `http://localhost:4200`:

1. **Happy path** (needs ADK running): type a message, press Enter → user bubble right-aligned in magenta, thinking dots appear, assistant reply arrives left-aligned; a second message reuses the session (network tab: second request body includes `sessionId`).
2. **Error path** (works without ADK): send a message → Nest returns 502 → red-tinted alert "Something went wrong — try again." appears above the composer; the user message stays in the log.
3. **Keyboard**: Shift+Enter inserts a newline and grows the textarea; Enter sends; after sending, focus stays in the textarea.
4. **Accessibility spot-checks**: press Tab on fresh load → skip link becomes visible first; the composer shows a visible focus ring; VoiceOver (or the browser a11y tree) shows `main`, `role="log"` labelled "Conversation", labelled textarea; with "reduce motion" enabled in macOS settings, the thinking dots do not animate.
