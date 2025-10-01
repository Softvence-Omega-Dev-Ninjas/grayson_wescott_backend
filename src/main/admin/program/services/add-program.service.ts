import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { AddProgramDto } from '../dto/add-program.dto';

@Injectable()
export class AddProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to add programme', 'Program')
  async addProgramme(dto: AddProgramDto): Promise<TResponse<any>> {
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: dto.userIds.map((u) => u),
        },
      },
    });

    if (users.length !== dto.userIds.length) {
      throw new AppError(404, 'Some users do not exist');
    }

    const programme = await this.prisma.program.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        categories: dto.categories ?? [],
        status: 'PUBLISHED',
        startDate: new Date(dto.startDate).toISOString(),
        endDate: new Date(dto.endDate).toISOString(),
        coachNote: dto.coachNote,
        exercises: {
          create: dto.exercises.map((e) => ({
            title: e.title,
            description: e.description ?? null,
            dayOfWeek: e.dayOfWeek,
            order: e.order,
            duration: e.duration ?? null,
            restSeconds: e.restSeconds ?? null,
            reps: e.reps ?? null,
            sets: e.sets ?? null,
            tempo: e.tempo ?? null,
            videoUrl: e.videoUrl ?? null,
          })),
        },
        userPrograms: {
          createMany: {
            data: dto.userIds.map((u) => ({
              userId: u,
            })),
          },
        },
      },
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

    return successResponse(programme, 'Program added successfully');
  }
}
