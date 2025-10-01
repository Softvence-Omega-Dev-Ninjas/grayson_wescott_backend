import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { CreateProgramExerciseDto } from '../dto/program-exercise.dto';
import {
  UpdateProgramDto,
  UpdateProgramExerciseDto,
} from '../dto/update-program.dto';

@Injectable()
export class UpdateProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to update program', 'Program')
  async updateProgram(
    id: string,
    dto: UpdateProgramDto,
  ): Promise<TResponse<any>> {
    // Check if program exists
    const program = await this.prisma.program.findUniqueOrThrow({
      where: { id },
      include: { exercises: true, userPrograms: true },
    });

    // Validate users
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds } },
    });
    if (users.length !== dto?.userIds?.length) {
      throw new AppError(404, 'Some users do not exist');
    }

    // Handle exercises
    const existingExerciseIds = program.exercises.map((e) => e.id);

    // Map DTO exercises: if exercise has an `id` -> update, else create
    const exercisesToCreate: CreateProgramExerciseDto[] = [];
    const exercisesToUpdate: UpdateProgramExerciseDto[] = [];

    if (dto.exercises) {
      dto.exercises?.forEach((e: any) => {
        if ('id' in e && existingExerciseIds.includes(e.id)) {
          exercisesToUpdate.push(e);
        } else {
          exercisesToCreate.push(e);
        }
      });
    }

    // Delete exercises not in DTO
    const dtoExerciseIds = dto?.exercises?.filter((e) => e.id).map((e) => e.id);
    const exercisesToDelete = program.exercises
      .filter((e) => !dtoExerciseIds?.includes(e.id))
      .map((e) => e.id);

    // Transaction: update program + exercises + users
    const updatedProgram = await this.prisma.$transaction(async (tx) => {
      // Update basic program info
      await tx.program.update({
        where: { id },
        data: {
          name: dto.name?.trim() ? dto.name : program.name,
          description: dto.description?.trim()
            ? dto.description
            : program.description,
          categories: dto.categories ? dto.categories : program.categories,
          startDate: dto.startDate
            ? new Date(dto.startDate).toISOString()
            : program.startDate,
          endDate: dto.endDate
            ? new Date(dto.endDate).toISOString()
            : program.endDate,
          coachNote: dto.coachNote?.trim() ? dto.coachNote : program.coachNote,
        },
      });

      // Delete removed exercises
      if (exercisesToDelete.length) {
        await tx.programExercise.deleteMany({
          where: { id: { in: exercisesToDelete } },
        });
      }

      // Update existing exercises
      for (const e of exercisesToUpdate) {
        await tx.programExercise.update({
          where: { id: e.id },
          data: {
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
          },
        });
      }

      // Create new exercises
      if (exercisesToCreate.length) {
        await tx.programExercise.createMany({
          data: exercisesToCreate.map((e) => ({
            programId: id,
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
        });
      }

      // Update user associations
      // Remove users not in DTO
      const dtoUserIds = dto.userIds;
      const currentUserIds = program.userPrograms.map((u) => u.userId);
      const usersToRemove = currentUserIds.filter(
        (id) => !dtoUserIds?.includes(id),
      );
      if (usersToRemove.length) {
        await tx.userProgram.deleteMany({
          where: { userId: { in: usersToRemove }, programId: id },
        });
      }

      // Add new users
      const usersToAdd = dtoUserIds?.filter(
        (id) => !currentUserIds.includes(id),
      );
      if (usersToAdd?.length) {
        await tx.userProgram.createMany({
          data: usersToAdd.map((userId) => ({
            programId: id,
            userId,
          })),
        });
      }

      // Return updated program with exercises and users
      return tx.program.findUnique({
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
    });

    return successResponse(updatedProgram, 'Program updated successfully');
  }
}
