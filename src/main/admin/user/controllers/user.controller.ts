import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { GetClientsForProgramDto } from '../dto/get-clients.dto';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../services/user.service';

@ApiTags('Admin --- User')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  @ApiOperation({ summary: 'Get all clients for program' })
  @Get('clients')
  findAllClient(@Query() query: GetClientsForProgramDto) {
    return this.userService.findAllClientForProgram(query);
  }

  @ApiOperation({ summary: 'Delete a client' })
  @Delete('clients/:userId')
  deleteAClient(@Param('userId') userId: string) {
    return this.userService.deleteAClient(userId);
  }

  @ApiOperation({ summary: 'Get all notifications for user' })
  @Get('clients/notifications')
  getNotifications(@GetUser('sub') userId: string) {
    return this.notificationService.getAllNotifications(userId);
  }
}
