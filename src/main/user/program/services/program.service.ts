import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch currently assigned program')
  async getSpecificAssignedProgram(
    userId: string,
    programId: string,
  ): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userPrograms: true },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Validate programId belongs to user
    const isAssigned = user.userPrograms.some(
      (up) => up.programId === programId && up.userId === userId,
    );
    if (!isAssigned) {
      throw new AppError(403, 'Program not assigned to user');
    }

    // fetch userProgram with related program & exercises
    const userProgram = await this.prisma.userProgram.findFirst({
      where: { userId, programId },
      include: {
        program: { include: { exercises: true } },
      },
    });

    if (!userProgram) {
      throw new AppError(404, 'Assigned program not found');
    }

    // timezone-aware now
    const userTimezone = user.timezone || 'UTC';
    const now = DateTime.now().setZone(userTimezone);
    // dayNumber / weekNumber (1-based)
    const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
      userTimezone,
    );
    const diffInDays = now
      .startOf('day')
      .diff(startDate.startOf('day'), 'days').days;
    const dayNumber = Math.floor(diffInDays) + 1;
    const weekNumber = Math.ceil(dayNumber / 7);

    // today's exercises (for UI)
    const todaysExercises = await this.prisma.userProgramExercise.findMany({
      where: {
        userProgramId: userProgram.id,
        dayNumber,
      },
      include: { programExercise: true },
    });

    // load all userProgramExercise rows for this userProgram (we'll aggregate in JS)
    const allUserProgramExercises =
      await this.prisma.userProgramExercise.findMany({
        where: { userProgramId: userProgram.id },
        include: { programExercise: true }, // so we can sum durations
      });

    // Program template & derived totals
    const exercisesPerWeek = userProgram.program.exercises.length || 0;
    const totalWeeks = Math.max(1, userProgram.program.duration || 1);
    const totalProgramDays = totalWeeks * 7;
    const totalExercises = exercisesPerWeek * totalWeeks;

    // Aggregations
    const completedExercises = allUserProgramExercises.filter(
      (e) => e.status === 'COMPLETED',
    ).length;

    const scheduledToDate = allUserProgramExercises.filter(
      (e) => e.dayNumber <= dayNumber,
    ).length;

    // planned load (sum of planned durations in minutes) up to today
    const plannedLoadToDate = allUserProgramExercises
      .filter((e) => e.dayNumber <= dayNumber)
      .reduce((sum, e) => sum + (e.programExercise?.duration ?? 0), 0);

    // completed load (sum of durations for completed exercises)
    const completedLoadToDate = allUserProgramExercises
      .filter((e) => e.status === 'COMPLETED')
      .reduce((sum, e) => sum + (e.programExercise?.duration ?? 0), 0);

    // safe percentages
    const completionPercent =
      totalExercises > 0
        ? Math.round((completedExercises / totalExercises) * 100)
        : 0;

    const complianceScore =
      scheduledToDate > 0
        ? Math.round((completedExercises / scheduledToDate) * 100)
        : 0;

    const loadCompletionPercent =
      plannedLoadToDate > 0
        ? Math.round((completedLoadToDate / plannedLoadToDate) * 100)
        : 0;

    // days remaining & percent elapsed (cap values)
    const daysElapsed = Math.min(Math.max(dayNumber, 0), totalProgramDays);
    const daysRemaining = Math.max(totalProgramDays - daysElapsed, 0);
    const percentProgramElapsed = Math.round(
      (daysElapsed / totalProgramDays) * 100,
    );

    // weekly summary (1..totalWeeks)
    const weeklySummary = Array.from({ length: totalWeeks }).map((_, i) => {
      const w = i + 1;
      const startDay = (w - 1) * 7 + 1;
      const endDay = w * 7;
      const scheduled = allUserProgramExercises.filter(
        (ex) => ex.dayNumber >= startDay && ex.dayNumber <= endDay,
      ).length;
      const completed = allUserProgramExercises.filter(
        (ex) =>
          ex.dayNumber >= startDay &&
          ex.dayNumber <= endDay &&
          ex.status === 'COMPLETED',
      ).length;
      const pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
      return {
        week: w,
        scheduled,
        completed,
        completionPercent: pct,
      };
    });

    const programProgressPercent = Math.min(
      Math.round((dayNumber / totalProgramDays) * 100),
      100,
    );

    const formattedOutput = {
      id: userProgram.id,
      startDate: userProgram.startDate,
      programProgressPercent,
      endDate: userProgram.endDate,
      status: userProgram.status,
      dayNumber,
      weekNumber,
      todaysExercises,
      user: {
        userId: userProgram.userId,
        timezone: userTimezone,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        name: user.name,
      },
      program: {
        programId: userProgram.programId,
        programName: userProgram.program.name,
        programDescription: userProgram.program.description,
        programDurationWeeks: totalWeeks,
        exercisesPerWeek,
        totalExercises,
      },
      analytics: {
        // counts
        completedExercises,
        totalExercises,
        trainingCompleted: `${completedExercises}/${totalExercises}`,
        scheduledToDate,

        // percentages
        completionPercent, // overall completed / total
        complianceScore, // completed / scheduled up-to-today

        // load (minutes)
        plannedLoadToDate, // sum of planned minutes up to today
        completedLoadToDate, // sum of durations for completed exercises
        loadCompletionPercent, // completedLoad / plannedLoad

        // progression
        daysElapsed,
        daysRemaining,
        percentProgramElapsed,

        // weekly breakdown
        weeklySummary,
      },
    };

    return successResponse(
      formattedOutput,
      'Currently assigned program fetched successfully',
    );
  }
}
