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

      // find userIds that already have an overlapping (active) program
      const overlapping = await tx.userProgram.findMany({
        where: {
          userId: { in: dto.userIds },
          AND: [
            { status: 'IN_PROGRESS' },
            { startDate: { lte: endDate } }, // existing starts on/before our end
            { endDate: { gte: startDate } }, // existing ends on/after our start
          ],
        },
        select: { userId: true },
      });
      const overlappingIds = new Set(overlapping.map((r) => r.userId));

      // filter userIds to only those without overlap
      const toAssign = [...new Set(dto.userIds)].filter(
        (id) => !overlappingIds.has(id),
      );

      if (toAssign.length > 0) {
        await tx.userProgram.createMany({
          data: toAssign.map((userId) => ({
            userId,
            programId: programme.id,
            startDate,
            endDate,
          })),
          skipDuplicates: true,
        });
      }

      // Metadata about skipped users
      const skippedUserIds = [...overlappingIds];

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

      return successResponse(
        {
          program: updatedProgram,
          skippedUserIds,
        },
        'Program added successfully',
      );
    });
  }

  @HandleError('Failed to assign users to program', 'Program')
  async assignUsersToProgram(
    programId: string,
    dto: AssignUsersToProgramDto,
  ): Promise<TResponse<any>> {
    const { userIds, startDate = new Date() } = dto;
    const uniqueIds = [...new Set(userIds)];

    const program = await this.prisma.program.findUnique({
      where: { id: programId },
    });
    if (!program) throw new AppError(404, 'Program not found');
    if (!program.duration)
      throw new AppError(400, 'Program duration is not set');

    const newStart = new Date(startDate);
    const newEnd = new Date(newStart);
    newEnd.setDate(newStart.getDate() + program.duration * 7);

    // Validate users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      throw new AppError(404, 'Some users do not exist');
    }

    // Find overlapping userPrograms for the requested window
    const overlapping = await this.prisma.userProgram.findMany({
      where: {
        userId: { in: uniqueIds },
        AND: [
          { status: 'IN_PROGRESS' },
          { startDate: { lte: newEnd } },
          { endDate: { gte: newStart } },
        ],
      },
      select: { userId: true },
    });
    const overlappingIds = new Set(overlapping.map((r) => r.userId));

    // users to actually create
    const toCreate = uniqueIds.filter((id) => !overlappingIds.has(id));

    if (toCreate.length > 0) {
      await this.prisma.userProgram.createMany({
        data: toCreate.map((u) => ({
          userId: u,
          programId,
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        })),
        skipDuplicates: true,
      });
    }

    // Fetch updated program (you may want to include skipped info in response)
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

    // Metadata about skipped users
    return successResponse(
      { program: updatedProgram, skippedUserIds: Array.from(overlappingIds) },
      'Users assigned to program successfully',
    );
  }
}
