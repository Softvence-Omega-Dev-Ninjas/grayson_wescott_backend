import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateSuperAdmin } from '@project/common/jwt/jwt.decorator';
import { AddAdminDto } from '../dto/add-admin.dto';
import { ManageAdminsService } from '../services/manage-admins.service';

@ApiTags('SuperAdmin --- Manage Admins')
@ApiBearerAuth()
@ValidateSuperAdmin()
@Controller('manage-admins')
export class ManageAdminsController {
  constructor(private readonly manageAdminsService: ManageAdminsService) {}

  @ApiOperation({ summary: 'Get all admins' })
  @Get()
  async getAllAdmins() {
    return await this.manageAdminsService.getAllAdmins();
  }

  @ApiOperation({ summary: 'Add admin' })
  @Post('add-admin')
  async addAdmin(@Body() data: AddAdminDto) {
    return await this.manageAdminsService.addAdmin(data);
  }

  @ApiOperation({ summary: 'Delete admin' })
  @Delete(':id')
  async deleteAdmin(@Param('id') id: string) {
    return await this.manageAdminsService.deleteAdmin(id);
  }
}
