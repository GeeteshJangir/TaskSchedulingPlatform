import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { QueueModule } from './queue/queue.module';
import { envValidationSchema } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RemindersModule } from './modules/reminders/reminders.module';

/**
 * Root module. Feature modules (auth, workspaces, projects, tasks, comments,
 * activity, notifications, scheduler) are added phase by phase per docs/PLAN.md.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    CacheModule.register({ isGlobal: true, ttl: 30_000 }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    QueueModule.forRoot(),
    CommonModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    ActivityModule,
    NotificationsModule,
    RemindersModule,
  ],
  providers: [
    // Global rate limiting (in-memory store; swap to Redis store for multi-instance).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
