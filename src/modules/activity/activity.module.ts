import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ActivityController } from './activity.controller';
import { ActivityListener } from './activity.listener';
import { ActivityService } from './activity.service';
import { TaskActivity } from './entities/task-activity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskActivity]),
    WorkspacesModule,
    TasksModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityListener],
})
export class ActivityModule {}
