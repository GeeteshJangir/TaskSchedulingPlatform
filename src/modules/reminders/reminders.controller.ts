import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  /**
   * Manually trigger a reminder scan (ops / testing). The cron runs this on a
   * schedule in the worker; this endpoint lets you run it on demand.
   */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run the due-task reminder scan now' })
  scan() {
    return this.reminders.scan();
  }
}
