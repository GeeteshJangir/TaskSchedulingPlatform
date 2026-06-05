import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';
import { ReminderStatus } from '../enums/reminder-status.enum';
import { ReminderType } from '../enums/reminder-type.enum';

@Entity('reminders')
@Unique('UQ_reminders_task_type_scheduled', ['taskId', 'type', 'scheduledFor'])
@Index('IDX_reminders_status_scheduled', ['status', 'scheduledFor'])
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: Task;

  @Column({ type: 'enum', enum: ReminderType, enumName: 'reminder_type' })
  type: ReminderType;

  @Column({ name: 'scheduled_for', type: 'timestamptz' })
  scheduledFor: Date;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    enumName: 'reminder_status',
    default: ReminderStatus.PENDING,
  })
  status: ReminderStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
