import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ChatDetailDto,
  ChatSummaryDto,
  SendChatMessageRequestDto,
  SendChatMessageResponseDto,
} from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  listChats(): Promise<ChatSummaryDto[]> {
    return this.chatService.listChats();
  }

  @Post()
  createChat(): Promise<ChatSummaryDto> {
    return this.chatService.createChat();
  }

  @Get(':chatId')
  getChat(@Param('chatId') chatId: string): Promise<ChatDetailDto> {
    return this.chatService.getChat(Number(chatId));
  }

  @Post(':chatId/messages')
  sendMessage(
    @Param('chatId') chatId: string,
    @Body() request: SendChatMessageRequestDto,
  ): Promise<SendChatMessageResponseDto> {
    return this.chatService.sendMessage(Number(chatId), request);
  }
}
