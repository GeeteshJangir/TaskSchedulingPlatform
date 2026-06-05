import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The invitation token from the invite link.' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
