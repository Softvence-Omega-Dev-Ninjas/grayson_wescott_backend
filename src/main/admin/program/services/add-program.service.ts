import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { AddProgramDto, AssignUsersToProgramDto } from '../dto/add-program.dto';

@Injectable()
export class AddProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to add programme', 'Program')
  async addProgramme(dto: AddProgramDto): Promise<TResponse<any>> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate users
      const users = await tx.user.findMany({
        where: { id: { in: dto.userIds } },
      });

      if (users.length !== dto.userIds.length) {
        throw new AppError(404, 'Some users do not exist');
      }

      // 2. Create program + exercises
      const programme = await tx.program.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          coachNote: dto.coachNote ?? null,
          categories: dto.categories ?? [],
          status: 'PUBLISHED',
          duration: dto.duration,
          exercises: {
            create: dto.exercises.map((e) => ({
              title: e.title,
              description: e.description ?? null,
              dayOfWeek: e.dayOfWeek,
              order: e.order,
              duration: e.duration ?? null,
              rest: e.rest ?? null,
              reps: e.reps ?? null,
              sets: e.sets ?? null,
              tempo: e.tempo ?? null,
              videoUrl: e.videoUrl ?? null,
            })),
          },
        },
      });

      // 3. Assign users to program (inline logic, no extra query roundtrip)
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + programme.duration * 7);

      await tx.userProgram.createMany({
        data: [...new Set(dto.userIds)].map((userId) => ({
          userId,
          programId: programme.id,
          startDate,
          endDate,
        })),
        skipDuplicates: true,
      });

      // 4. Return program with exercises + users
      const updatedProgram = await tx.program.findUnique({
        where: { id: programme.id },
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

      return successResponse(updatedProgram, 'Program added successfully');
    });
  }

  @HandleError('Failed to assign users to program', 'Program')
  async assignUsersToProgram(
    programId: string,
    dto: AssignUsersToProgramDto,
  ): Promise<TResponse<any>> {
    const { userIds, startDate = new Date() } = dto;

    // ensure unique ids
    const uniqueIds = [...new Set(userIds)];

    // 1. Fetch program for duration
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new AppError(404, 'Program not found');
    if (!program.duration)
      throw new AppError(400, 'Program duration is not set');

    // 2. Validate users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new AppError(404, 'Some users do not exist');
    }

    // 3. Calculate dates
    const endDate = new Date(startDate);
    // duration stored in weeks
    endDate.setDate(new Date(startDate).getDate() + program.duration * 7);

    // 4. Create many (skip duplicates)
    await this.prisma.userProgram.createMany({
      data: uniqueIds.map((u) => ({
        userId: u,
        programId,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      })),
      skipDuplicates: true,
    });

    // 5. Return update program
    const updatedProgram = await this.prisma.program.findUnique({
      where: { id: programId },
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

    return successResponse(
      updatedProgram,
      'Users assigned to program successfully',
    );
  }
}
