import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { GetLibraryExerciseDto } from '@project/main/admin/library/dto/get-library-exercise.dto';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { ExerciseLibraryService } from './services/exercise-library.service';
import { GetNotificationService } from './services/get-notification.service';

@ApiTags('Client --- Stats, Notifications & Exercises Library')
@ApiBearerAuth()
@ValidateAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardStatsService: DashboardStatsService,
    private readonly exerciseLibraryService: ExerciseLibraryService,
    private readonly getNotificationService: GetNotificationService,
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

  @ApiOperation({ summary: 'Get notifications' })
  @Get('notifications/me')
  async getNotifications(@GetUser('sub') userId: string) {
    return this.getNotificationService.getAUserNotification(userId);
  }

  @ApiOperation({ summary: 'Get messages notifications' })
  @Get('messages/notifications/me')
  async getMessagesNotifications(@GetUser('sub') userId: string) {
    return this.getNotificationService.getAUsersMessagesNotifications(userId);
  }
}
