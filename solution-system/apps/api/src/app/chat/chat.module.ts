import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AgentService } from '../agent.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatMessage } from './db/chat-message.model';
import { Chat } from './db/chat.model';

@Module({
  imports: [SequelizeModule.forFeature([Chat, ChatMessage])],
  controllers: [ChatController],
  providers: [AgentService, ChatService],
})
export class ChatModule {}
