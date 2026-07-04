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
