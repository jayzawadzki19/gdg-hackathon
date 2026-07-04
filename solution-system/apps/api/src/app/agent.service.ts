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
  errorCode?: string;
  errorMessage?: string;
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
    let event: AdkEvent;

    try {
      event = JSON.parse(payload) as AdkEvent;
    } catch {
      return [];
    }

    if (event.errorCode || event.errorMessage) {
      throw new BadGatewayException(this.formatAdkError(event));
    }

    if (!event.author || event.author === 'user') {
      return [];
    }

    return (
      event.content?.parts
        ?.map((part) => part.text?.trim())
        .filter((text): text is string => Boolean(text)) ?? []
    );
  }

  private formatAdkError(event: AdkEvent): string {
    const code = event.errorCode ? ` ${event.errorCode}` : '';
    const message = event.errorMessage ? `: ${event.errorMessage}` : '';

    return `ADK error${code}${message}`;
  }
}
