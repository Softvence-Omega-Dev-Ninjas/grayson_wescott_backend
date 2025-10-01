import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { GetProgramsDto } from '../dto/get-programs.dto';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get programs', 'PROGRAMS')
  async getPrograms(dto: GetProgramsDto): Promise<TPaginatedResponse<any>> {
    const { page = 1, limit = 10, search, categories, userId, status } = dto;

    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (categories && categories.length > 0) {
      where.categories = { hasSome: categories };
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userPrograms = { some: { userId } };
    }

    const [total, programs] = await this.prisma.$transaction([
      this.prisma.program.count({ where }),
      this.prisma.program.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          exercises: true,
          userPrograms: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                  avatarUrl: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return successPaginatedResponse(
      programs,
      {
        page,
        limit,
        total,
      },
      'Programs found successfully',
    );
  }

  @HandleError('Failed to get program', 'PROGRAM')
  async getProgram(id: string): Promise<TResponse<any>> {
    const program = await this.prisma.program.findUniqueOrThrow({
      where: { id },
      include: {
        exercises: true,
        userPrograms: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatarUrl: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return successResponse(program, 'Program found successfully');
  }

  @HandleError('Failed to delete program', 'PROGRAM')
  async deleteProgram(id: string): Promise<TResponse<any>> {
    await this.prisma.program.delete({ where: { id } });
    return successResponse(null, 'Program deleted successfully');
  }
}
