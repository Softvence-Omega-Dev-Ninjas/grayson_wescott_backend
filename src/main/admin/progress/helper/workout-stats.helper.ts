// src/progress/utils/workout-stats.helper.ts
import { PrismaClient } from '@prisma/client';
import { weekdayToEnum } from '@project/main/user/program/utils/progress-tracking.helper';
import { DateTime } from 'luxon';

export async function computeWorkoutStatsAdmin(
  prisma: PrismaClient,
  userTimezone = 'UTC',
) {
  const now = DateTime.now().setZone(userTimezone);
  const startOfWeek = now.startOf('week');
  const endOfWeek = now.endOf('week');
  const startOfMonth = now.startOf('month');
  const endOfMonth = now.endOf('month');
  const startOfDay = now.startOf('day');

  const userPrograms = await prisma.userProgram.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      program: { include: { exercises: true } },
    },
  });

  let plannedTotal = 0;
  let plannedToday = 0;
  let plannedThisWeek = 0;
  let plannedThisMonth = 0;

  for (const up of userPrograms) {
    if (!up.startDate || !up.program) continue;

    const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);
    const durationWeeks =
      up.program.duration && up.program.duration > 0 ? up.program.duration : 1;

    const endDate = startDate.plus({ weeks: durationWeeks });

    // iterate through timeline of this userProgram
    for (
      let date = startDate.startOf('day');
      date <= endDate;
      date = date.plus({ days: 1 })
    ) {
      const weekdayEnum = weekdayToEnum(date.weekday);

      for (const ex of up.program.exercises) {
        if (ex.dayOfWeek === weekdayEnum) {
          plannedTotal += 1;

          if (date >= startOfWeek && date <= endOfWeek) {
            plannedThisWeek += 1;
          }
          if (date >= startOfMonth && date <= endOfMonth) {
            plannedThisMonth += 1;
          }
          if (date.hasSame(startOfDay, 'day')) {
            plannedToday += 1;
          }
        }
      }
    }
  }

  // --- Completed workouts ---
  const totalCompleted = await prisma.userProgramExercise.count({
    where: { status: 'COMPLETED' },
  });

  const completedToday = await prisma.userProgramExercise.count({
    where: { status: 'COMPLETED', completedAt: { gte: startOfDay.toJSDate() } },
  });

  const completedThisWeek = await prisma.userProgramExercise.count({
    where: {
      status: 'COMPLETED',
      completedAt: {
        gte: startOfWeek.toJSDate(),
        lte: endOfWeek.toJSDate(),
      },
    },
  });

  const completedThisMonth = await prisma.userProgramExercise.count({
    where: {
      status: 'COMPLETED',
      completedAt: {
        gte: startOfMonth.toJSDate(),
        lte: endOfMonth.toJSDate(),
      },
    },
  });

  // --- Derived percentages ---
  const overallCompletionPercent =
    plannedTotal > 0 ? Math.round((totalCompleted / plannedTotal) * 100) : 0;

  const adherenceThisWeek =
    plannedThisWeek > 0
      ? Math.round((completedThisWeek / plannedThisWeek) * 100)
      : 0;

  const adherenceThisMonth =
    plannedThisMonth > 0
      ? Math.round((completedThisMonth / plannedThisMonth) * 100)
      : 0;

  return {
    planned: {
      total: plannedTotal,
      today: plannedToday,
      thisWeek: plannedThisWeek,
      thisMonth: plannedThisMonth,
    },
    completed: {
      total: totalCompleted,
      today: completedToday,
      thisWeek: completedThisWeek,
      thisMonth: completedThisMonth,
    },
    rates: {
      overallCompletionPercent: `${overallCompletionPercent}%`,
      adherenceThisWeek: `${adherenceThisWeek}%`,
      adherenceThisMonth: `${adherenceThisMonth}%`,
    },
  };
}
