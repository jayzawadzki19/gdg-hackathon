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
