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

    // assign users
    await this.assignUsersToProgram(programme.id, {
      userIds: dto.userIds,
    });

    // return program with exercises and assigned users
    const updatedProgram = await this.prisma.program.findUnique({
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

    // 5. Return assigned userPrograms with user info
    const assigned = await this.prisma.userProgram.findMany({
      where: { programId, userId: { in: uniqueIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
    });

    return successResponse(assigned, 'Users assigned to program successfully');
  }
}
