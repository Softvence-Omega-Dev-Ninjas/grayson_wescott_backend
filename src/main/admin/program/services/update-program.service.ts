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
      include: {
        exercises: true,
        userPrograms: true,
        programCategories: true,
      },
    });

    // Validate users
    if (dto.userIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: dto.userIds } },
      });
      if (users.length !== dto.userIds.length) {
        throw new AppError(404, 'Some users do not exist');
      }
    }

    // Validate category
    if (dto.categories?.length) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: dto.categories } },
      });
      if (categories.length !== dto.categories.length) {
        throw new AppError(404, 'Some categories do not exist');
      }
    }

    // Handle exercises
    const existingExerciseIds = program.exercises.map((e) => e.id);

    const exercisesToCreate: CreateProgramExerciseDto[] = [];
    const exercisesToUpdate: UpdateProgramExerciseDto[] = [];

    if (dto.exercises) {
      dto.exercises.forEach((e: any) => {
        if ('id' in e && existingExerciseIds.includes(e.id)) {
          exercisesToUpdate.push(e);
        } else {
          exercisesToCreate.push(e);
        }
      });
    }

    const dtoExerciseIds = dto.exercises?.filter((e) => e.id).map((e) => e.id);
    const exercisesToDelete = program.exercises
      .filter((e) => !dtoExerciseIds?.includes(e.id))
      .map((e) => e.id);

    // Transaction: update program + exercises + users + category
    const updatedProgram = await this.prisma.$transaction(async (tx) => {
      // Update basic program info
      await tx.program.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? program.name,
          description: dto.description?.trim() ?? program.description,
          coachNote: dto.coachNote?.trim() ?? program.coachNote,
          duration: dto.duration ?? program.duration,
          status: dto.status ?? program.status,
        },
      });

      // Update program category
      if (dto.categories?.length) {
        await tx.programCategory.deleteMany({
          where: { programId: id },
        });
        await tx.programCategory.createMany({
          data: dto.categories.map((c) => ({ programId: id, categoryId: c })),
        });
      }

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
            // order: e.order,
            duration: e.duration ?? null,
            rest: e.restSeconds ?? null,
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
            // order: e.order,
            duration: e.duration ?? null,
            rest: e.restSeconds ?? null,
            reps: e.reps ?? null,
            sets: e.sets ?? null,
            tempo: e.tempo ?? null,
            videoUrl: e.videoUrl ?? null,
          })),
        });
      }

      // Update user associations
      if (dto.userIds?.length) {
        const currentUserIds = program.userPrograms.map((u) => u.userId);
        const usersToRemove = currentUserIds.filter(
          (id) => !dto.userIds?.includes(id),
        );
        if (usersToRemove.length) {
          await tx.userProgram.deleteMany({
            where: { userId: { in: usersToRemove }, programId: id },
          });
        }

        const usersToAdd = dto.userIds.filter(
          (id) => !currentUserIds.includes(id),
        );
        if (usersToAdd.length) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + (program.duration ?? 0) * 7);

          await tx.userProgram.createMany({
            data: usersToAdd.map((userId) => ({
              userId,
              programId: id,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            })),
            skipDuplicates: true,
          });
        }
      }

      // Return updated program with exercises, users, and category
      return await tx.program.findUnique({
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
          programCategories: {
            include: { category: true },
          },
        },
      });
    });

    return successResponse(updatedProgram, 'Program updated successfully');
  }
}
