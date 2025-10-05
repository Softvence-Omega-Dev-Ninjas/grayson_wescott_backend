import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';
import {
  computeCompletedMetrics,
  computeTemplateMetrics,
  formatMinutes,
} from '../utils/progress-tracking.helper';

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

    // 2) load assigned programs with templates & logs
    const userPrograms = await this.prisma.userProgram.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            exercises: true, // template exercises
          },
        },
        userProgramExercise: {
          include: { programExercise: true }, // user logs
        },
      },
    });

    const totalPrograms = userPrograms.length;

    // Global accumulators
    let totalPlannedExercisesFull = 0; // full program (template * weeks)
    let totalPlannedLoadFull = 0; // full planned minutes across programs
    let totalPlannedVolumeFull = 0; // full planned reps (sets*reps) across programs

    let scheduledExercisesToDate = 0; // scheduled up-to-date (template calendar)
    let plannedLoadToDate = 0; // planned minutes up-to-date
    let plannedVolumeToDate = 0; // planned reps up-to-date

    let totalCompletedExercises = 0; // from logs (COMPLETED)
    let completedLoadToDate = 0; // minutes from completed logs
    let estimatedVolumeCompleted = 0; // reps from completed logs

    const perProgram: any[] = [];

    for (const up of userPrograms) {
      const program = up.program;
      const templateExercises = program?.exercises ?? [];

      const programWeeks =
        program?.duration && program.duration > 0 ? program.duration : 1;

      // timezone-aware start date (nullable)
      const startDate = up.startDate
        ? DateTime.fromJSDate(up.startDate).setZone(userTimezone)
        : null;

      // days passed since start (1-based)
      const diffDays =
        startDate != null
          ? now.startOf('day').diff(startDate.startOf('day'), 'days').days
          : 0;
      const dayNumberNow =
        startDate && diffDays >= 0 ? Math.floor(diffDays) + 1 : 0;

      const programTotalDays = programWeeks * 7;
      const daysToCount =
        dayNumberNow > 0 ? Math.min(dayNumberNow, programTotalDays) : 0;

      // compute template-only metrics (both up-to-date and full-plan)
      const templateMetrics = computeTemplateMetrics(
        templateExercises,
        startDate,
        daysToCount,
        programWeeks,
      );
      // compute log-based metrics
      const assignedLogs = up.userProgramExercise ?? [];
      const completedMetrics = computeCompletedMetrics(assignedLogs);
      // { completedCount, completedLoad, completedVolume }

      // accumulate global aggregates
      totalPlannedExercisesFull += templateMetrics.totalPlannedExercisesFull;
      totalPlannedLoadFull += templateMetrics.totalPlannedLoadFull;
      totalPlannedVolumeFull += templateMetrics.totalPlannedVolumeFull;

      scheduledExercisesToDate += templateMetrics.scheduledCountUpToDate;
      plannedLoadToDate += templateMetrics.plannedLoadUpToDate;
      plannedVolumeToDate += templateMetrics.plannedVolumeUpToDate;

      totalCompletedExercises += completedMetrics.completedCount;
      completedLoadToDate += completedMetrics.completedLoad;
      estimatedVolumeCompleted += completedMetrics.completedVolume;

      // per-program percentages:
      const completionPercentFull =
        templateMetrics.totalPlannedExercisesFull > 0
          ? Math.min(
              100,
              Math.round(
                (completedMetrics.completedCount /
                  templateMetrics.totalPlannedExercisesFull) *
                  100,
              ),
            )
          : 0;

      const adherencePercentUpToDate =
        templateMetrics.scheduledCountUpToDate > 0
          ? Math.min(
              100,
              Math.round(
                (completedMetrics.completedCount /
                  templateMetrics.scheduledCountUpToDate) *
                  100,
              ),
            )
          : 0;

      const loadAdherencePercentUpToDate =
        templateMetrics.plannedLoadUpToDate > 0
          ? Math.min(
              100,
              Math.round(
                (completedMetrics.completedLoad /
                  templateMetrics.plannedLoadUpToDate) *
                  100,
              ),
            )
          : 0;

      const volumeAdherencePercentUpToDate =
        templateMetrics.plannedVolumeUpToDate > 0
          ? Math.min(
              100,
              Math.round(
                (completedMetrics.completedVolume /
                  templateMetrics.plannedVolumeUpToDate) *
                  100,
              ),
            )
          : 0;

      perProgram.push({
        programId: program?.id ?? null,
        programName: program?.name ?? null,
        programDescription: program?.description ?? null,
        programDuration: program?.duration ?? null,
        weeks: programWeeks,
        startDate: startDate ? startDate.toISODate() : null,
        template: {
          totalPlannedExercisesFull: templateMetrics.totalPlannedExercisesFull,
          totalPlannedLoadFull: templateMetrics.totalPlannedLoadFull,
          totalPlannedVolumeFull: templateMetrics.totalPlannedVolumeFull,
          scheduledToDate: templateMetrics.scheduledCountUpToDate,
          plannedLoadToDate: templateMetrics.plannedLoadUpToDate,
          plannedVolumeToDate: templateMetrics.plannedVolumeUpToDate,
        },
        logs: {
          completedExercises: completedMetrics.completedCount,
          completedLoad: completedMetrics.completedLoad,
          completedVolume: completedMetrics.completedVolume,
        },
        percent: {
          completionOfFullPlan: completionPercentFull,
          adherenceUpToDate: adherencePercentUpToDate,
          loadAdherenceUpToDate: loadAdherencePercentUpToDate,
          volumeAdherenceUpToDate: volumeAdherencePercentUpToDate,
        },
      });
    }

    // GLOBAL derived metrics

    // overall completion vs full plan (completed vs full planned)
    const overallCompletionPercentFull =
      totalPlannedExercisesFull > 0
        ? Math.min(
            100,
            Math.round(
              (totalCompletedExercises / totalPlannedExercisesFull) * 100,
            ),
          )
        : 0;

    // adherence up-to-date (completed vs scheduled up-to-date)
    const adherencePercentUpToDate =
      scheduledExercisesToDate > 0
        ? Math.min(
            100,
            Math.round(
              (totalCompletedExercises / scheduledExercisesToDate) * 100,
            ),
          )
        : 0;

    // load: FULL (normal) target comes from full template plans across programs
    const loadPercentOfFull =
      totalPlannedLoadFull > 0
        ? Math.min(
            100,
            Math.round((completedLoadToDate / totalPlannedLoadFull) * 100),
          )
        : 0;

    // load adherence up-to-date (completed / plannedUpToDate)
    const loadAdherencePercent =
      plannedLoadToDate > 0
        ? Math.min(
            100,
            Math.round((completedLoadToDate / plannedLoadToDate) * 100),
          )
        : 0;

    // volume: FULL (normal) percent vs full template
    const volumePercentOfFull =
      totalPlannedVolumeFull > 0
        ? Math.min(
            100,
            Math.round(
              (estimatedVolumeCompleted / totalPlannedVolumeFull) * 100,
            ),
          )
        : 0;

    // volume adherence up-to-date (completed / plannedUpToDate)
    const volumeAdherencePercent =
      plannedVolumeToDate > 0
        ? Math.min(
            100,
            Math.round((estimatedVolumeCompleted / plannedVolumeToDate) * 100),
          )
        : 0;

    const averageSessionDuration =
      totalCompletedExercises > 0
        ? Math.round(completedLoadToDate / totalCompletedExercises)
        : 0;

    const avgVolumePerSession =
      totalCompletedExercises > 0
        ? Math.round(estimatedVolumeCompleted / totalCompletedExercises)
        : 0;

    // Build response objects: NOTE separation between "normal/full-template" and "adherence/up-to-date"
    const exercises = {
      target: totalPlannedExercisesFull,
      completed: totalCompletedExercises,
      percent: overallCompletionPercentFull,
      unit: 'exercises',
      label: `${totalCompletedExercises}/${totalPlannedExercisesFull} done`,
    };

    const load = {
      // NORMAL: full template totals (what you planned for the whole program)
      target: totalPlannedLoadFull,
      // completed so far (from logs)
      completed: completedLoadToDate,
      // percent relative to full plan
      percent: loadPercentOfFull,
      unit: 'mins',
      label: `${formatMinutes(completedLoadToDate)} done`,
    };

    const exercisesAdherence = {
      scheduled: scheduledExercisesToDate,
      completed: totalCompletedExercises,
      percent: adherencePercentUpToDate,
      unit: 'exercises',
      label: `${adherencePercentUpToDate}% adherence`,
    };

    const loadAdherence = {
      // ADHERENCE: planned up-to-date vs completed up-to-date
      planned: plannedLoadToDate,
      completed: completedLoadToDate,
      percent: loadAdherencePercent,
      unit: 'mins',
      label: `${loadAdherencePercent}% of planned`,
    };

    const volume = {
      // NORMAL: full planned volume across all programs (template)
      planned: totalPlannedVolumeFull,
      completed: estimatedVolumeCompleted,
      percent: volumePercentOfFull,
      unit: 'reps',
      label: `${estimatedVolumeCompleted}/${totalPlannedVolumeFull} reps`,
    };

    const volumeAdherence = {
      planned: plannedVolumeToDate,
      completed: estimatedVolumeCompleted,
      percent: volumeAdherencePercent,
      unit: 'reps',
      label: `${volumeAdherencePercent}% of planned`,
    };

    const formatted = {
      totalPrograms,
      totalPlannedExercisesFull,
      trainingCompletedExercises: totalCompletedExercises,
      adherenceRateUpToDate: adherencePercentUpToDate,
      averageSessionDurationMins: averageSessionDuration,
      estimatedVolumeCompleted,
      averageVolumePerSession: avgVolumePerSession,
      summary: {
        exercises,
        exercisesAdherence,
        load,
        loadAdherence,
        volume,
        volumeAdherence,
      },
      perProgram,
    };

    return successResponse(formatted, 'User progress retrieved successfully');
  }
}
