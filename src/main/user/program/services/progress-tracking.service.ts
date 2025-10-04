import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class ProgressTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Progress across all assigned programs for a user.
   * Uses only fields available in ProgramExercise & UserProgramExercise:
   * - duration (minutes)
   * - reps, sets (optional) -> used to calculate estimated volume when available
   *
   * Returns minutes for trainingCompleted because schema lacks weight/PR data.
   */
  @HandleError('Failed to get user progress', 'USER_PROGRAM')
  async getUserProgress(userId: string): Promise<TResponse<any>> {
    // load user for timezone fallback
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        timezone: true,
        name: true,
        email: true,
        avatarUrl: true,
        phone: true,
      },
    });

    if (!user) {
      return successResponse(null, 'User not found');
    }

    const userTimezone = user.timezone || 'UTC';
    const now = DateTime.now().setZone(userTimezone);

    // Load all user programs with exercises + program meta
    const userPrograms = await this.prisma.userProgram.findMany({
      where: { userId },
      include: {
        program: { select: { id: true, name: true, duration: true } },
        userProgramExercise: {
          include: { programExercise: true }, // for duration / reps / sets
        },
      },
    });

    const totalPrograms = userPrograms.length;

    // Global aggregates
    let totalAssignedExercises = 0;
    let totalCompletedExercises = 0;
    let scheduledToDate = 0; // exercises that should have been done up-to-today across all programs
    let plannedLoadToDate = 0; // sum of planned durations (mins) for scheduledToDate
    let completedLoadToDate = 0; // sum of durations (mins) for completed exercises
    let estimatedVolumeCompleted = 0; // sum of reps * sets for completed exercises where both exist

    const programSummaries: Array<any> = [];

    for (const up of userPrograms) {
      const programWeeks = up.program?.duration ?? 0;
      const programTotalDays = Math.max(0, programWeeks * 7);

      const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);
      const diffDays = now
        .startOf('day')
        .diff(startDate.startOf('day'), 'days').days;
      const dayNumberNow = diffDays >= 0 ? Math.floor(diffDays) + 1 : 0; // 1-based or 0 if not started
      const daysElapsedCapped =
        programTotalDays > 0
          ? Math.min(Math.max(dayNumberNow, 0), programTotalDays)
          : 0;

      const assigned = up.userProgramExercise.length;
      const completed = up.userProgramExercise.filter(
        (e) => e.status === 'COMPLETED',
      ).length;

      // scheduledToDate for this program: exercises with dayNumber <= dayNumberNow
      const scheduled = up.userProgramExercise.filter(
        (e) => dayNumberNow > 0 && e.dayNumber <= dayNumberNow,
      ).length;

      // planned load to date: sum durations for scheduled exercises (duration may be null)
      const plannedLoad = up.userProgramExercise
        .filter((e) => dayNumberNow > 0 && e.dayNumber <= dayNumberNow)
        .reduce((sum, e) => sum + (e.programExercise?.duration ?? 0), 0);

      // completed load: sum durations for completed exercises
      const completedLoad = up.userProgramExercise
        .filter((e) => e.status === 'COMPLETED')
        .reduce((sum, e) => sum + (e.programExercise?.duration ?? 0), 0);

      // estimated volume from reps * sets for completed exercises (only when both present)
      const volCompleted = up.userProgramExercise
        .filter((e) => e.status === 'COMPLETED' && e.programExercise)
        .reduce((sum, e) => {
          const reps = e.programExercise?.reps ?? 0;
          const sets = e.programExercise?.sets ?? 0;
          if (reps > 0 && sets > 0) return sum + reps * sets;
          return sum;
        }, 0);

      // accumulate global totals
      totalAssignedExercises += assigned;
      totalCompletedExercises += completed;
      scheduledToDate += scheduled;
      plannedLoadToDate += plannedLoad;
      completedLoadToDate += completedLoad;
      estimatedVolumeCompleted += volCompleted;

      programSummaries.push({
        userProgramId: up.id,
        programId: up.program?.id ?? null,
        programName: up.program?.name ?? null,
        programDurationWeeks: programWeeks,
        assignedExercises: assigned,
        completedExercises: completed,
        scheduledToDate: scheduled,
        plannedLoadToDate: plannedLoad,
        completedLoadToDate: completedLoad,
        estimatedVolumeCompleted: volCompleted, // reps * sets
        dayNumberNow,
        daysElapsed: daysElapsedCapped,
        daysRemaining:
          programTotalDays > 0
            ? Math.max(programTotalDays - daysElapsedCapped, 0)
            : null,
        status: up.status,
      });
    }

    // derived metrics (safe / guarded)
    const overallCompletionPercent =
      totalAssignedExercises > 0
        ? Math.round((totalCompletedExercises / totalAssignedExercises) * 100)
        : 0;

    const adherenceRate =
      scheduledToDate > 0
        ? Math.round((totalCompletedExercises / scheduledToDate) * 100)
        : 0;

    const loadCompletionPercent =
      plannedLoadToDate > 0
        ? Math.round((completedLoadToDate / plannedLoadToDate) * 100)
        : 0;

    // average session duration (mins) for completed sessions
    const completedSessionsCount = totalCompletedExercises;
    const averageSessionDuration =
      completedSessionsCount > 0
        ? Math.round(completedLoadToDate / completedSessionsCount)
        : 0;

    // format trainingCompleted similar to UI: show numeric and human-friendly label
    const trainingCompleted = {
      value: completedLoadToDate,
      unit: 'mins',
      label: `${completedLoadToDate} mins`,
    };

    const formatted = {
      summary: {
        totalPrograms,
        scheduledToDate, // exercises that should have been done up-to-today
        trainingCompleted, // minutes-based
        trainingPlannedToDate: {
          value: plannedLoadToDate,
          unit: 'mins',
          label: `${plannedLoadToDate} mins`,
        },
        exercise: {
          totalAssignedExercises,
          totalCompletedExercises,
          overallCompletionPercent,
        },
        adherenceRate, // completed / scheduled-to-date
        plannedLoadToDate,
        completedLoadToDate,
        loadCompletionPercent,
        averageSessionDuration, // mins per completed session
        estimatedVolumeCompleted, // naive reps*sets sum when available
      },
      programSummaries,
    };

    return successResponse(formatted, 'User progress retrieved successfully');
  }
}
