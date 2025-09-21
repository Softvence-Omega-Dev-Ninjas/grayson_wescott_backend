import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { GetClientsForProgramDto } from '../dto/get-clients.dto';
import { UserResponseDto } from './../../../../common/dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Failed to get users', 'USER')
  async findAllClientForProgram(
    query: GetClientsForProgramDto,
  ): Promise<TPaginatedResponse<any>> {
    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    // Find users assigned to a specific program
    const where: Prisma.UserWhereInput = {};

    // Optional search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch total count for pagination
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    const sanitizedUsers = await Promise.all(
      users.map(async (user) => {
        const sanitizedUser = await this.utils.sanitizedResponse(
          UserResponseDto,
          user,
        );
        return sanitizedUser;
      }),
    );

    return successPaginatedResponse(
      sanitizedUsers,
      {
        page,
        limit,
        total,
      },
      'Users fetched successfully',
    );
  }
}
