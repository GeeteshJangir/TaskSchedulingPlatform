import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Task } from '../tasks/entities/task.entity';
import { Reminder } from './entities/reminder.entity';
import { ReminderProcessor } from './reminder.processor';
import { RemindersController } from './reminders.controller';
import { REMINDERS_QUEUE } from './reminders.constants';
import { RemindersService } from './reminders.service';
import { SchedulerService } from './scheduler.service';

const queueEnabled = process.env.QUEUE_ENABLED === 'true';
const isWorker = process.env.RUN_MODE === 'worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, Task]),
    NotificationsModule,
    // Producers (scan) inject the queue; the worker also runs the processor.
    ...(queueEnabled
      ? [BullModule.registerQueue({ name: REMINDERS_QUEUE })]
      : []),
  ],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    // Cron runs only in the worker; the queue processor too.
    ...(isWorker ? [SchedulerService] : []),
    ...(queueEnabled && isWorker ? [ReminderProcessor] : []),
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
