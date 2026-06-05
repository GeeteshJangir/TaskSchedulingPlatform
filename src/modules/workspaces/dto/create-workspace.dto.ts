import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional({
    example: 'acme',
    description: 'Optional slug; derived from name when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;
}
