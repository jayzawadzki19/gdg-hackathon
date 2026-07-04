import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onModuleInit(): Promise<void> {
    await this.sequelize.authenticate();
    this.logger.log('Database connected successfully');
  }
}
