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
export class ProgressTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get user progress', 'USER_PROGRAM')
  async getUserProgress(userId: string): Promise<TResponse<any>> {
    // 1) load user (for timezone)
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
      throw new AppError(404, 'User not found');
    }

    const userTimezone = user.timezone || 'UTC';
    const now = DateTime.now().setZone(userTimezone);

    // 2) load all assigned programs with their userProgramExercise rows & program template exercises
    const userPrograms = await this.prisma.userProgram.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            exercises: true, // template exercises (dayOfWeek, duration, reps, sets, etc.)
          },
        },
        userProgramExercise: {
          include: { programExercise: true }, // actual user logs (may be missing until created)
        },
      },
    });

    const totalPrograms = userPrograms.length;

    // 3) globals
    let totalAssignedExercises = 0; // total planned across whole program (template * weeks)
    let totalCompletedExercises = 0; // completed logs
    let scheduledExercisesToDate = 0; // computed from template calendar up-to-today
    let plannedLoadToDate = 0; // minutes planned from template calendar up-to-today
    let completedLoadToDate = 0; // minutes from completed logs
    let estimatedVolumeCompleted = 0; // sum reps*sets from completed logs (when both exist)

    // helper: map Luxon weekday (1=Mon..7=Sun) to DayOfWeek enum string
    const weekdayToEnum = (weekday: number) => {
      const map = [
        '', // 0
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ];
      return map[weekday] as
        | 'MONDAY'
        | 'TUESDAY'
        | 'WEDNESDAY'
        | 'THURSDAY'
        | 'FRIDAY'
        | 'SATURDAY'
        | 'SUNDAY';
    };

    // 4) per-program computation
    for (const up of userPrograms) {
      const program = up.program;
      const templateExercises = program?.exercises ?? [];
      const templateCountPerWeek = templateExercises.length;

      // program duration in weeks; if missing or 0, treat as 1 week (safe default)
      const programWeeks =
        program?.duration && program.duration > 0 ? program.duration : 1;
      const programTotalDays = programWeeks * 7;

      // timezone-aware start date
      const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);

      // how many calendar days passed since start (1-based dayNumberNow)
      const diffDays = now
        .startOf('day')
        .diff(startDate.startOf('day'), 'days').days;
      const dayNumberNow = diffDays >= 0 ? Math.floor(diffDays) + 1 : 0; // 0 => not started

      // days to consider for scheduling (capped by programTotalDays)
      const daysToCount =
        dayNumberNow > 0 ? Math.min(dayNumberNow, programTotalDays) : 0;

      // --- scheduledExercisesToDate & plannedLoadToDate from template calendar ---
      let scheduledCountForProgram = 0;
      let plannedLoadForProgram = 0;

      for (let offset = 0; offset < daysToCount; offset++) {
        const date = startDate.plus({ days: offset });
        const weekdayEnum = weekdayToEnum(date.weekday);

        // count template exercises scheduled for this weekday
        for (const te of templateExercises) {
          if (!te || !te.dayOfWeek) continue;
          if (te.dayOfWeek === weekdayEnum) {
            scheduledCountForProgram += 1;
            plannedLoadForProgram += te.duration ?? 0;
          }
        }
      }

      // --- total planned across whole program (templateCountPerWeek * weeks) ---
      const totalPlannedForProgram = templateCountPerWeek * programWeeks;

      // --- completed & completedLoad come from user logs (actual performed items) ---
      const assignedLogs = up.userProgramExercise ?? [];
      const completedLogs = assignedLogs.filter(
        (e) => e.status === 'COMPLETED',
      );

      const completedCountForProgram = completedLogs.length;
      const completedLoadForProgram = completedLogs.reduce(
        (s, e) => s + (e.programExercise?.duration ?? 0),
        0,
      );

      const volCompletedForProgram = completedLogs.reduce((s, e) => {
        const reps = e.programExercise?.reps ?? 0;
        const sets = e.programExercise?.sets ?? 0;
        return s + (reps > 0 && sets > 0 ? reps * sets : 0);
      }, 0);

      // 5) accumulate to globals
      totalAssignedExercises += totalPlannedForProgram;
      totalCompletedExercises += completedCountForProgram;
      scheduledExercisesToDate += scheduledCountForProgram;
      plannedLoadToDate += plannedLoadForProgram;
      completedLoadToDate += completedLoadForProgram;
      estimatedVolumeCompleted += volCompletedForProgram;
    }

    // 6) derived metrics & guards (cap percentages 0..100)
    const overallCompletionPercent =
      totalAssignedExercises > 0
        ? Math.min(
            100,
            Math.round(
              (totalCompletedExercises / totalAssignedExercises) * 100,
            ),
          )
        : 0;

    const adherencePercent =
      scheduledExercisesToDate > 0
        ? Math.min(
            100,
            Math.round(
              (totalCompletedExercises / scheduledExercisesToDate) * 100,
            ),
          )
        : 0;

    const loadCompletionPercent =
      plannedLoadToDate > 0
        ? Math.min(
            100,
            Math.round((completedLoadToDate / plannedLoadToDate) * 100),
          )
        : 0;

    const averageSessionDuration =
      totalCompletedExercises > 0
        ? Math.round(completedLoadToDate / totalCompletedExercises)
        : 0;

    // 7) build final synchronized response
    const exercises = {
      target: totalAssignedExercises,
      completed: totalCompletedExercises,
      percent: overallCompletionPercent,
      unit: 'exercises',
      label: `${totalCompletedExercises}/${totalAssignedExercises} done`,
    };

    const load = {
      target: plannedLoadToDate,
      completed: completedLoadToDate,
      percent: loadCompletionPercent,
      unit: 'mins',
      label: `${this.formatMinutes(completedLoadToDate)} done`,
    };

    const exercisesAdherence = {
      scheduled: scheduledExercisesToDate,
      completed: totalCompletedExercises,
      percent: adherencePercent,
      unit: 'exercises',
      label: `${adherencePercent}% adherence`,
    };

    const loadAdherence = {
      planned: plannedLoadToDate,
      completed: completedLoadToDate,
      percent: loadCompletionPercent,
      unit: 'mins',
      label: `${loadCompletionPercent}% of planned`,
    };

    const formatted = {
      totalPrograms,
      totalPlannedExercises: totalAssignedExercises,
      trainingCompletedExercises: totalCompletedExercises,
      adherenceRate: adherencePercent,
      averageSessionDurationMins: averageSessionDuration,
      estimatedVolumeCompleted,
      summary: {
        exercises,
        load,
        exercisesAdherence,
        loadAdherence,
      },
    };

    return successResponse(formatted, 'User progress retrieved successfully');
  }

  // Helper: convert minutes into "H hrs M mins" (or "Xm" when <60)
  private formatMinutes(mins: number) {
    if (!mins || mins <= 0) return '0 mins';
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes} mins`;
    if (minutes === 0) return `${hours} hrs`;
    return `${hours} hrs ${minutes} mins`;
  }
}
