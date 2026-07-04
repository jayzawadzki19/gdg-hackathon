export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id?: number;
  role: ChatRole;
  text: string;
  createdAt?: string;
}

export interface ChatSummary {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
}

export interface SendChatMessageRequest {
  message: string;
}

export interface SendChatMessageResponse {
  chatId: number;
  title: string;
  messages: ChatMessage[];
}
