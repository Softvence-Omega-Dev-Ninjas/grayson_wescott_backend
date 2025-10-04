import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { ManageDailyExerciseDto } from '../dto/manage-daily-exercise.dto';
import { GetAProgramService } from '../services/get-a-program.service';
import { GetAllProgramService } from '../services/get-all-program.service';
import { ManageDailyProgramService } from '../services/manage-daily-program.service';

@ApiTags('Client --- Program')
@ApiBearerAuth()
@ValidateAuth()
@Controller('program/user')
export class ProgramController {
  constructor(
    private readonly programService: GetAProgramService,
    private readonly manageDailyProgramService: ManageDailyProgramService,
    private readonly getAllProgramService: GetAllProgramService,
  ) {}

  @ApiOperation({ summary: 'Get all Assigned Programs' })
  @Get('assigned')
  async getAllAssignedPrograms(
    @GetUser('sub') userId: string,
    @Query() query: PaginationDto,
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
