import { Module } from '@nestjs/common';
import { UserController } from './controllers/user.controller';
import { UserService } from './services/user.service';
import { ManageAdminsController } from './controllers/manage-admins.controller';
import { ManageAdminsService } from './services/manage-admins.service';
import { NotificationService } from './services/notification.service';

@Module({
  controllers: [UserController, ManageAdminsController],
  providers: [UserService, ManageAdminsService, NotificationService],
})
export class UserModule {}
