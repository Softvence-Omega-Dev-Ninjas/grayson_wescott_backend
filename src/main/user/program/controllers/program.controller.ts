import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { ManageDailyExerciseDto } from '../dto/manage-daily-exercise.dto';
import { ManageDailyProgramService } from '../services/manage-daily-program.service';
import { ProgramService } from '../services/program.service';

@ApiTags('Client --- Program')
@ApiBearerAuth()
@ValidateAuth()
@Controller('program/user')
export class ProgramController {
  constructor(
    private readonly programService: ProgramService,
    private readonly manageDailyProgramService: ManageDailyProgramService,
  ) {}

  @ApiOperation({ summary: 'Get Currently Assigned Program' })
  @Get('currently-assigned')
  async getCurrentlyAssignedProgram(@GetUser('sub') userId: string) {
    return this.programService.getCurrentlyAssignedProgram(userId);
  }

  @ApiOperation({
    summary: 'Manage a Daily Exercise Log',
    description: 'enum status: PENDING, IN_PROGRESS, COMPLETED',
  })
  @Post('manage-exercise-log/:uxId')
  async manageDailyExerciseLog(
    @Param('uxId') uxId: string,
    @Body() body: ManageDailyExerciseDto,
  ) {
    return this.manageDailyProgramService.manageADailyExerciseLog(uxId, body);
  }
}
