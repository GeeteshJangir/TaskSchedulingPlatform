import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({
    nullable: true,
    description: 'New parent task id, or null to move the task to the top level.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentTaskId: string | null;
}
