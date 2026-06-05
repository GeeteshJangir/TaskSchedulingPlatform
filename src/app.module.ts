import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';

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
    CommonModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
  ],
})
export class AppModule {}
