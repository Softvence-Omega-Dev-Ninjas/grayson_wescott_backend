import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { successResponse, TResponse } from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { AddAdminDto } from '../dto/add-admin.dto';

@Injectable()
export class ManageAdminsService {
  constructor(
    private readonly utils: UtilsService,
    private readonly prisma: PrismaService,
  ) {}

  @HandleError('Failed to fetch admins', 'Users')
  async getAllAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    });

    const sanitizedUsers = await Promise.all(
      admins.map(async (user) => {
        const sanitizedUser = await this.utils.sanitizedResponse(
          UserResponseDto,
          user,
        );
        return sanitizedUser;
      }),
    );

    return successResponse(sanitizedUsers, 'Admins fetched successfully');
  }

  @HandleError('Failed to add admin', 'Admin')
  async addAdmin(data: AddAdminDto): Promise<TResponse<any>> {
    const admin = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: await this.utils.hash(data.password),
        role: data.role,
      },
    });

    const sanitizedAdmin = await this.utils.sanitizedResponse(
      UserResponseDto,
      admin,
    );

    return successResponse(sanitizedAdmin, 'Admin added successfully');
  }

  @HandleError('Failed to delete admin', 'Admin')
  async deleteAdmin(id: string): Promise<TResponse<any>> {
    await this.prisma.user.delete({ where: { id } });
    return successResponse(null, 'Admin deleted successfully');
  }
}
