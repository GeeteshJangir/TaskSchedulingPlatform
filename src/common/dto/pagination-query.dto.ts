import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Base query DTO for keyset (cursor) pagination. Feature list endpoints extend
 * this with their own filters/sort. See docs/ARCHITECTURE.md §8.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description:
      'Opaque keyset cursor returned as meta.nextCursor from a previous page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
