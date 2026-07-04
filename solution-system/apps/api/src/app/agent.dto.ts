export interface AgentMessageRequestDto {
  message: string;
  sessionId?: string;
}

export interface AgentMessageResponseDto {
  sessionId: string;
  text: string;
}
