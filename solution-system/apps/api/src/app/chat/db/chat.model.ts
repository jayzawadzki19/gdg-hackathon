import {
  AutoIncrement,
  Column,
  DataType,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { ChatMessage } from './chat-message.model';

@Table({
  tableName: 'chats',
  timestamps: true,
})
export class Chat extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @Column({
    field: 'adk_session_id',
    type: DataType.STRING,
    allowNull: false,
  })
  declare adkSessionId: string;

  @Column({
    field: 'user_id',
    type: DataType.STRING,
    allowNull: false,
  })
  declare userId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare title: string;

  @HasMany(() => ChatMessage)
  declare messages?: ChatMessage[];

  declare createdAt: Date;
  declare updatedAt: Date;
}
