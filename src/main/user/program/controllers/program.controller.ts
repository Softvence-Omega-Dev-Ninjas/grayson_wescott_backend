import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { CurrentlyAssignedProgramDto } from '../dto/currently-assigned-program.dto';
import { ManageDailyExerciseDto } from '../dto/manage-daily-exercise.dto';
import { GetAProgramService } from '../services/get-a-program.service';
import { GetAllProgramService } from '../services/get-all-program.service';
import { ManageDailyProgramService } from '../services/manage-daily-program.service';
import { ProgressTrackingService } from '../services/progress-tracking.service';
import { WorkUtHistoryService } from '../services/workout-history.service';

@ApiTags('Client --- Program')
@ApiBearerAuth()
@ValidateAuth()
@Controller('user/programs')
export class ProgramController {
  constructor(
    private readonly programService: GetAProgramService,
    private readonly manageDailyProgramService: ManageDailyProgramService,
    private readonly getAllProgramService: GetAllProgramService,
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly workUtHistoryService: WorkUtHistoryService,
  ) {}

  @ApiOperation({ summary: 'Get all Assigned Programs' })
  @Get()
  async getAllAssignedPrograms(
    @GetUser('sub') userId: string,
    @Query() query: CurrentlyAssignedProgramDto,
  ) {
    return this.getAllProgramService.getAllPrograms(userId, query);
  }

  @ApiOperation({ summary: 'Get a specific Assigned Program' })
  @Get(':id')
  async getSpecificAssignedProgram(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.programService.getSpecificAssignedProgram(userId, id);
  }

  @ApiOperation({ summary: 'Get User Progress' })
  @Get('progress/tracking')
  async getUserProgress(@GetUser('sub') userId: string) {
    return this.progressTrackingService.getUserProgress(userId);
  }

  @ApiOperation({
    summary: 'Manage a Daily Exercise Log',
    description: 'enum status: PENDING, IN_PROGRESS, COMPLETED',
  })
  @Post('exercises/:exerciseId/log')
  async manageDailyExerciseLog(
    @Param('uxId') uxId: string,
    @Body() body: ManageDailyExerciseDto,
  ) {
    return this.manageDailyProgramService.manageADailyExerciseLog(uxId, body);
  }

  @ApiOperation({ summary: "Get User's Work UT History" })
  @Get('workout/history')
  async getMyWorkoutHistory(
    @GetUser('sub') userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.workUtHistoryService.getMyWorkoutHistory(userId, query);
  }
}
