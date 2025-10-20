import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { GetLibraryExerciseDto } from '@project/main/admin/library/dto/get-library-exercise.dto';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { ExerciseLibraryService } from './services/exercise-library.service';

@ApiTags('Client --- Dashboard & Exercises Library')
@ApiBearerAuth()
@ValidateAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardStatsService: DashboardStatsService,
    private readonly exerciseLibraryService: ExerciseLibraryService,
  ) {}

  @ApiOperation({ summary: 'Get dashboard stats' })
  @Get()
  async getDashboardStats(@GetUser('sub') userId: string) {
    return this.dashboardStatsService.getDashboardStats(userId);
  }

  @ApiOperation({ summary: 'Get exercise library' })
  @Get('library')
  async getLibraryExercises(
    @GetUser('sub') userId: string,
    @Query() query: GetLibraryExerciseDto,
  ) {
    return this.exerciseLibraryService.getLibraryExercises(userId, query);
  }

  @ApiOperation({ summary: 'Get single exercise from library' })
  @Get('library/:id')
  async getSingleExerciseFromLibrary(
    @GetUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.exerciseLibraryService.getSingleExerciseFromLibrary(userId, id);
  }
}
