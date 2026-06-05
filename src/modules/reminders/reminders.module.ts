import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../tasks/entities/task.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Reminder } from './entities/reminder.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { SchedulerService } from './scheduler.service';

// The cron driver runs only in the worker process; the API exposes the manual
// scan trigger and shares the RemindersService.
const isWorker = process.env.RUN_MODE === 'worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder, Task]),
    NotificationsModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, ...(isWorker ? [SchedulerService] : [])],
  exports: [RemindersService],
})
export class RemindersModule {}
