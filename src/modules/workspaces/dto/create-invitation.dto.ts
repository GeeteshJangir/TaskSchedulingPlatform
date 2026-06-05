import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export class CreateInvitationDto {
  @ApiProperty({ example: 'newhire@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: WorkspaceRole, default: WorkspaceRole.MEMBER })
  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}
