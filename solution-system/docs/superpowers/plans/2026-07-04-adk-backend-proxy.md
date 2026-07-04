# ADK Backend Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nest API proxy endpoint that accepts client messages, forwards them to the existing ADK agent service, and returns a clean JSON response.

**Architecture:** Keep the ADK agent as a separate HTTP service. Add a focused `AgentController` and `AgentService` to `apps/api`; the service creates/reuses ADK sessions, calls `/run_sse`, parses model text from returned events, and maps upstream failures to Nest exceptions. Docker Compose wires `api -> adk-agent -> mcp-server` through service DNS names.

**Tech Stack:** NestJS 11, TypeScript, Jest, Axios, Nx, Bun commands, Docker Compose.

---

## File Structure

- Create `apps/api/src/app/agent.dto.ts`: public request/response DTOs for the backend route.
- Create `apps/api/src/app/agent.controller.ts`: `POST /api/agent/messages` route.
- Create `apps/api/src/app/agent.service.ts`: ADK session creation, run call, SSE/event parsing, error mapping.
- Create `apps/api/src/app/agent.controller.spec.ts`: controller unit tests with mocked service.
- Create `apps/api/src/app/agent.service.spec.ts`: service unit tests with mocked Axios.
- Modify `apps/api/src/app/app.module.ts`: register `AgentController` and `AgentService`.
- Create `apps/api/Dockerfile`: build and run the Nest API container.
- Create `.dockerignore`: keep the API Docker build context small.
- Modify `docker-compose.yml`: add the `api` service and service-to-service environment variables.

## Task 1: Public Agent Route Contract

**Files:**
- Create: `apps/api/src/app/agent.dto.ts`
- Create: `apps/api/src/app/agent.controller.ts`
- Create: `apps/api/src/app/agent.controller.spec.ts`
- Modify: `apps/api/src/app/app.module.ts`

- [ ] **Step 1: Create DTOs**

Create `apps/api/src/app/agent.dto.ts`:

```typescript
export interface AgentMessageRequestDto {
  message: string;
  sessionId?: string;
}

export interface AgentMessageResponseDto {
  sessionId: string;
  text: string;
}
```

- [ ] **Step 2: Write the failing controller test**

Create `apps/api/src/app/agent.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

describe('AgentController', () => {
  let controller: AgentController;
  let service: jest.Mocked<Pick<AgentService, 'sendMessage'>>;

  beforeEach(async () => {
    service = {
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: service }],
    }).compile();

    controller = module.get<AgentController>(AgentController);
  });

  it('delegates message requests to the agent service', async () => {
    service.sendMessage.mockResolvedValue({
      sessionId: 'session-123',
      text: 'Use segmentation to isolate the slow path.',
    });

    await expect(
      controller.sendMessage({
        message: 'Improve latency without increasing cost',
        sessionId: 'session-123',
      }),
    ).resolves.toEqual({
      sessionId: 'session-123',
      text: 'Use segmentation to isolate the slow path.',
    });

    expect(service.sendMessage).toHaveBeenCalledWith({
      message: 'Improve latency without increasing cost',
      sessionId: 'session-123',
    });
  });
});
```

- [ ] **Step 3: Run the controller test to verify it fails**

Run:

```sh
bun nx test api --testFile=apps/api/src/app/agent.controller.spec.ts
```

Expected: fail because `agent.controller.ts` and `agent.service.ts` do not exist yet.

- [ ] **Step 4: Implement the minimal controller**

Create `apps/api/src/app/agent.controller.ts`:

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import {
  AgentMessageRequestDto,
  AgentMessageResponseDto,
} from './agent.dto';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('messages')
  sendMessage(
    @Body() request: AgentMessageRequestDto,
  ): Promise<AgentMessageResponseDto> {
    return this.agentService.sendMessage(request);
  }
}
```

Create a temporary minimal `apps/api/src/app/agent.service.ts` so the controller test can compile:

```typescript
import { Injectable } from '@nestjs/common';
import {
  AgentMessageRequestDto,
  AgentMessageResponseDto,
} from './agent.dto';

@Injectable()
export class AgentService {
  sendMessage(
    request: AgentMessageRequestDto,
  ): Promise<AgentMessageResponseDto> {
    return Promise.resolve({
      sessionId: request.sessionId ?? '',
      text: request.message,
    });
  }
}
```

- [ ] **Step 5: Register the controller and service**

Modify `apps/api/src/app/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController, AgentController],
  providers: [AppService, AgentService],
})
export class AppModule {}
```

- [ ] **Step 6: Run the controller test to verify it passes**

Run:

```sh
bun nx test api --testFile=apps/api/src/app/agent.controller.spec.ts
```

Expected: pass.

## Task 2: ADK Service Behavior

**Files:**
- Modify: `apps/api/src/app/agent.service.ts`
- Create: `apps/api/src/app/agent.service.spec.ts`

- [ ] **Step 1: Write service tests for session creation, reuse, SSE parsing, and failures**

Create `apps/api/src/app/agent.service.spec.ts`:

```typescript
import axios from 'axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { AgentService } from './agent.service';

jest.mock('axios');

const mockedAxios = jest.mocked(axios, true);

describe('AgentService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      ADK_AGENT_URL: 'http://adk-agent:8081',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates a session when no sessionId is provided', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({
        data: [
          'data: {"author":"root_agent","content":{"parts":[{"text":"Solved."}]}}',
          '',
        ].join('\n'),
      });

    const service = new AgentService();

    await expect(
      service.sendMessage({ message: 'Solve this contradiction' }),
    ).resolves.toEqual({
      sessionId: 'new-session',
      text: 'Solved.',
    });

    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'http://adk-agent:8081/apps/agent/users/user/sessions',
      {},
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'http://adk-agent:8081/run_sse',
      {
        appName: 'agent',
        userId: 'user',
        sessionId: 'new-session',
        newMessage: {
          role: 'user',
          parts: [{ text: 'Solve this contradiction' }],
        },
      },
      {
        headers: {
          Accept: 'text/event-stream',
        },
        responseType: 'text',
      },
    );
  });

  it('reuses a provided sessionId', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: [
        'data: {"author":"root_agent","content":{"parts":[{"text":"Still solved."}]}}',
        '',
      ].join('\n'),
    });

    const service = new AgentService();

    await expect(
      service.sendMessage({
        message: 'Continue',
        sessionId: 'existing-session',
      }),
    ).resolves.toEqual({
      sessionId: 'existing-session',
      text: 'Still solved.',
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://adk-agent:8081/run_sse',
      expect.objectContaining({ sessionId: 'existing-session' }),
      expect.any(Object),
    );
  });

  it('rejects empty messages', async () => {
    const service = new AgentService();

    await expect(service.sendMessage({ message: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('extracts the latest non-user model text from event stream data', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { sessionId: 'session-from-alt-key' } })
      .mockResolvedValueOnce({
        data: [
          'data: {"author":"user","content":{"parts":[{"text":"Question"}]}}',
          'data: {"author":"root_agent","content":{"parts":[{"text":"First draft"}]}}',
          'data: {"author":"root_agent","content":{"parts":[{"text":"Final answer"}]}}',
          '',
        ].join('\n'),
      });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).resolves.toEqual({
      sessionId: 'session-from-alt-key',
      text: 'Final answer',
    });
  });

  it('maps upstream session failures to BadGatewayException', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('connection refused'));

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps malformed run responses to BadGatewayException', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { id: 'new-session' } })
      .mockResolvedValueOnce({ data: 'data: {"author":"root_agent"}\n\n' });

    const service = new AgentService();

    await expect(service.sendMessage({ message: 'Question' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```sh
bun nx test api --testFile=apps/api/src/app/agent.service.spec.ts
```

Expected: fail because `AgentService` only echoes the temporary response.

- [ ] **Step 3: Replace the temporary service with ADK proxy logic**

Replace `apps/api/src/app/agent.service.ts`:

```typescript
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import {
  AgentMessageRequestDto,
  AgentMessageResponseDto,
} from './agent.dto';

interface AdkSessionResponse {
  id?: string;
  sessionId?: string;
}

interface AdkEventPart {
  text?: string;
}

interface AdkEvent {
  author?: string;
  content?: {
    parts?: AdkEventPart[];
  };
}

@Injectable()
export class AgentService {
  private readonly adkAgentUrl =
    process.env.ADK_AGENT_URL ?? 'http://localhost:8081';

  async sendMessage(
    request: AgentMessageRequestDto,
  ): Promise<AgentMessageResponseDto> {
    const message = request.message?.trim();

    if (!message) {
      throw new BadRequestException('Message is required.');
    }

    const sessionId = request.sessionId?.trim() || (await this.createSession());
    const eventStream = await this.runAgent(sessionId, message);

    return {
      sessionId,
      text: this.extractModelText(eventStream),
    };
  }

  private async createSession(): Promise<string> {
    try {
      const response = await axios.post<AdkSessionResponse>(
        `${this.adkAgentUrl}/apps/agent/users/user/sessions`,
        {},
      );
      const sessionId = response.data.id ?? response.data.sessionId;

      if (!sessionId) {
        throw new Error('ADK session response did not include a session id.');
      }

      return sessionId;
    } catch {
      throw new BadGatewayException('Unable to create an ADK session.');
    }
  }

  private async runAgent(sessionId: string, message: string): Promise<string> {
    try {
      const response = await axios.post<string>(
        `${this.adkAgentUrl}/run_sse`,
        {
          appName: 'agent',
          userId: 'user',
          sessionId,
          newMessage: {
            role: 'user',
            parts: [{ text: message }],
          },
        },
        {
          headers: {
            Accept: 'text/event-stream',
          },
          responseType: 'text',
        },
      );

      return response.data;
    } catch {
      throw new BadGatewayException('Unable to run the ADK agent.');
    }
  }

  private extractModelText(eventStream: string): string {
    const modelTexts = eventStream
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trim())
      .filter((payload) => payload && payload !== '[DONE]')
      .flatMap((payload) => this.parseEventText(payload));

    const text = modelTexts.at(-1);

    if (!text) {
      throw new BadGatewayException('ADK response did not include model text.');
    }

    return text;
  }

  private parseEventText(payload: string): string[] {
    try {
      const event = JSON.parse(payload) as AdkEvent;

      if (!event.author || event.author === 'user') {
        return [];
      }

      return (
        event.content?.parts
          ?.map((part) => part.text?.trim())
          .filter((text): text is string => Boolean(text)) ?? []
      );
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run service and controller tests**

Run:

```sh
bun nx test api --testFile=apps/api/src/app/agent.service.spec.ts
bun nx test api --testFile=apps/api/src/app/agent.controller.spec.ts
```

Expected: both pass.

## Task 3: Container Wiring

**Files:**
- Create: `.dockerignore`
- Create: `apps/api/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add root Docker ignore rules**

Create `.dockerignore`:

```dockerignore
.git
.cursor
coverage
dist
node_modules
tmp
```

- [ ] **Step 2: Add the API Dockerfile**

Create `apps/api/Dockerfile`:

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY eslint.config.mjs jest.config.ts jest.preset.js ./
COPY apps ./apps

RUN bun install
RUN bun nx build api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "dist/apps/api/main.js"]
```

- [ ] **Step 3: Wire services in Compose**

Replace `docker-compose.yml`:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      PORT: 3000
      ADK_AGENT_URL: http://adk-agent:8081
    ports:
      - "3000:3000"
    depends_on:
      - adk-agent

  adk-agent:
    build:
      context: ./adg-agents
    environment:
      GOOGLE_API_KEY: ${GOOGLE_API_KEY:-}
      MCP_SERVER_URL: http://mcp-server:8000/mcp
    ports:
      - "8081:8081"
    depends_on:
      - mcp-server

  mcp-server:
    build:
      context: ./mcp-server
    ports:
      - "8000:8000"
```

- [ ] **Step 4: Build the API locally**

Run:

```sh
bun nx build api
```

Expected: build succeeds and emits `dist/apps/api/main.js`.

## Task 4: Verification

**Files:**
- Check: all files changed above

- [ ] **Step 1: Run all API tests**

Run:

```sh
bun nx test api
```

Expected: all API tests pass.

- [ ] **Step 2: Run lint for the API project**

Run:

```sh
bun nx eslint:lint api
```

Expected: lint succeeds. If this target is unavailable, run:

```sh
bun nx show project api
```

and use the listed lint target name.

- [ ] **Step 3: Run Docker Compose build**

Run:

```sh
docker compose build
```

Expected: `api`, `adk-agent`, and `mcp-server` images build successfully.

- [ ] **Step 4: Manual proxy smoke test**

Run:

```sh
docker compose up --build
```

In a second terminal, run:

```sh
curl -X POST http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"Suggest a TRIZ approach for improving latency without increasing infrastructure cost"}'
```

Expected: JSON response containing a non-empty `sessionId` and `text`.

## Self-Review

Spec coverage:

- Public backend proxy endpoint is covered in Task 1.
- ADK session creation, session reuse, `/run_sse`, SSE parsing, and error mapping are covered in Task 2.
- Docker service URLs and `api -> adk-agent -> mcp-server` wiring are covered in Task 3.
- Focused tests and manual verification are covered in Task 4.

Placeholder scan:

- No `TBD`, `TODO`, "similar to", or missing test instructions remain.

Type consistency:

- DTO names are consistent across controller, service, and tests.
- The service method is consistently named `sendMessage`.
- The public route remains `POST /api/agent/messages` through Nest's global `api` prefix and controller-local `agent/messages` path.
