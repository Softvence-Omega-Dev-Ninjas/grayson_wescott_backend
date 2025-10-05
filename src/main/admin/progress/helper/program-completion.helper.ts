import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function computeProgramCompletionAdmin(
  prisma: PrismaClient,
  userTimezone = 'UTC',
) {
  const now = DateTime.now().setZone(userTimezone);

  const startOfWeek = now.startOf('week');
  const endOfWeek = now.endOf('week');
  const prevWeekStart = startOfWeek.minus({ weeks: 1 });
  const prevWeekEnd = endOfWeek.minus({ weeks: 1 });

  const startOfMonth = now.startOf('month');
  const endOfMonth = now.endOf('month');
  const prevMonthStart = startOfMonth.minus({ months: 1 });
  const prevMonthEnd = endOfMonth.minus({ months: 1 });

  // load userPrograms (the instantiated schedules) with template & logs
  const userPrograms = await prisma.userProgram.findMany({
    include: {
      program: { include: { exercises: true } },
      userProgramExercise: true, // logs
    },
  });

  // totals
  let totalPlannedFull = 0;
  let totalCompletedFull = 0;

  let scheduledUpToNow = 0;
  let completedUpToNow = 0;

  let plannedThisWeek = 0;
  let completedThisWeek = 0;
  let plannedPrevWeek = 0;
  let completedPrevWeek = 0;

  let plannedThisMonth = 0;
  let completedThisMonth = 0;
  let plannedPrevMonth = 0;
  let completedPrevMonth = 0;

  // helper: map Luxon weekday to enum (MONDAY..SUNDAY)
  const weekdayToEnum = (weekday: number) => {
    const map = [
      '',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];
    return map[weekday] as string;
  };

  for (const up of userPrograms) {
    const program = up.program;
    const template = program?.exercises ?? [];
    if (!up.startDate || !program) continue;

    const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);
    const weeks =
      program.duration && program.duration > 0 ? program.duration : 1;
    // make endDate inclusive (start + weeks - 1 day)
    const endDate = startDate.plus({ weeks }).minus({ days: 1 });

    // 1) FULL plan totals for this userProgram (weekly * weeks)
    const weeklyCount = template.length;
    const plannedFullForProgram = weeklyCount * weeks;
    totalPlannedFull += plannedFullForProgram;

    // 2) iterate each day in the program window and count planned occurrences into buckets
    for (
      let d = startDate.startOf('day');
      d <= endDate.startOf('day');
      d = d.plus({ days: 1 })
    ) {
      const weekdayEnum = weekdayToEnum(d.weekday);

      for (const ex of template) {
        if (!ex?.dayOfWeek) continue;
        if (ex.dayOfWeek === weekdayEnum) {
          // planned for this date
          // full plan was already accounted by weeklyCount * weeks, but we need date-level breakdown
          if (d <= now.startOf('day')) {
            scheduledUpToNow += 1;
          }

          if (d >= startOfWeek.startOf('day') && d <= endOfWeek.endOf('day')) {
            plannedThisWeek += 1;
          }
          if (
            d >= prevWeekStart.startOf('day') &&
            d <= prevWeekEnd.endOf('day')
          ) {
            plannedPrevWeek += 1;
          }

          if (
            d >= startOfMonth.startOf('day') &&
            d <= endOfMonth.endOf('day')
          ) {
            plannedThisMonth += 1;
          }
          if (
            d >= prevMonthStart.startOf('day') &&
            d <= prevMonthEnd.endOf('day')
          ) {
            plannedPrevMonth += 1;
          }
        }
      }
    }

    // 3) completed logs for this userProgram (use completedAt)
    const logs = up.userProgramExercise ?? [];
    for (const log of logs) {
      if (!log || log.status !== 'COMPLETED' || !log.completedAt) continue;

      const completedAt = DateTime.fromJSDate(log.completedAt).setZone(
        userTimezone,
      );
      totalCompletedFull += 1;

      if (completedAt <= now.endOf('day')) {
        completedUpToNow += 1;
      }

      if (
        completedAt >= startOfWeek.startOf('day') &&
        completedAt <= endOfWeek.endOf('day')
      ) {
        completedThisWeek += 1;
      }
      if (
        completedAt >= prevWeekStart.startOf('day') &&
        completedAt <= prevWeekEnd.endOf('day')
      ) {
        completedPrevWeek += 1;
      }

      if (
        completedAt >= startOfMonth.startOf('day') &&
        completedAt <= endOfMonth.endOf('day')
      ) {
        completedThisMonth += 1;
      }
      if (
        completedAt >= prevMonthStart.startOf('day') &&
        completedAt <= prevMonthEnd.endOf('day')
      ) {
        completedPrevMonth += 1;
      }
    }
  }

  // --- compute rates & increments ---
  const overallCompletionRate =
    totalPlannedFull > 0
      ? Math.round((totalCompletedFull / totalPlannedFull) * 100)
      : 0;

  // completion this window
  const completionThisWeek =
    plannedThisWeek > 0
      ? Math.round((completedThisWeek / plannedThisWeek) * 100)
      : 0;
  const completionPrevWeek =
    plannedPrevWeek > 0
      ? Math.round((completedPrevWeek / plannedPrevWeek) * 100)
      : 0;
  const completionThisMonth =
    plannedThisMonth > 0
      ? Math.round((completedThisMonth / plannedThisMonth) * 100)
      : 0;
  const completionPrevMonth =
    plannedPrevMonth > 0
      ? Math.round((completedPrevMonth / plannedPrevMonth) * 100)
      : 0;

  const completionIncrementThisWeek = completionThisWeek - completionPrevWeek;
  const completionIncrementThisMonth =
    completionThisMonth - completionPrevMonth;

  // adherence: use scheduledUpToNow as denominator (what should have been done by today)
  const overallAdherenceRate =
    scheduledUpToNow > 0
      ? Math.round((completedUpToNow / scheduledUpToNow) * 100)
      : 0;

  // adherence for week/month (same as completionThisWeek/ThisMonth conceptually)
  const adherenceThisWeek = completionThisWeek; // completedThisWeek / plannedThisWeek
  const adherenceThisMonth = completionThisMonth;

  const adherenceIncrementThisWeek = completionIncrementThisWeek;
  const adherenceIncrementThisMonth = completionIncrementThisMonth;

  // Format result
  // return {
  //   programCompletion: {
  //     total: {
  //       overallCompletionRate: `${overallCompletionRate}%`,
  //       completionRateThisWeek: `${completionThisWeek}%`,
  //       completionRateThisMonth: `${completionThisMonth}%`,
  //       completionRateIncrementThisWeek: `${completionIncrementThisWeek >= 0 ? '+' : ''}${completionIncrementThisWeek}%`,
  //       completionRateIncrementThisMonth: `${completionIncrementThisMonth >= 0 ? '+' : ''}${completionIncrementThisMonth}%`,
  //     },
  //     adherence: {
  //       overallAdherenceRate: `${overallAdherenceRate}%`,
  //       adherenceRateThisWeek: `${adherenceThisWeek}%`,
  //       adherenceRateThisMonth: `${adherenceThisMonth}%`,
  //       adherenceRateIncrementThisWeek: `${adherenceIncrementThisWeek >= 0 ? '+' : ''}${adherenceIncrementThisWeek}%`,
  //       adherenceRateIncrementThisMonth: `${adherenceIncrementThisMonth >= 0 ? '+' : ''}${adherenceIncrementThisMonth}%`,
  //     },
  //   },
  //   // also return raw numbers if you want to display or debug
  //   _raw: {
  //     totalPlannedFull,
  //     totalCompletedFull,
  //     scheduledUpToNow,
  //     completedUpToNow,
  //     plannedThisWeek,
  //     completedThisWeek,
  //     plannedPrevWeek,
  //     completedPrevWeek,
  //     plannedThisMonth,
  //     completedThisMonth,
  //     plannedPrevMonth,
  //     completedPrevMonth,
  //   },
  // };
  return {
    total: {
      overallCompletionRate: `${overallCompletionRate}%`,
      completionRateThisWeek: `${completionThisWeek}%`,
      completionRateThisMonth: `${completionThisMonth}%`,
      completionRateIncrementThisWeek: `${completionIncrementThisWeek >= 0 ? '+' : ''}${completionIncrementThisWeek}%`,
      completionRateIncrementThisMonth: `${completionIncrementThisMonth >= 0 ? '+' : ''}${completionIncrementThisMonth}%`,
    },
    adherence: {
      overallAdherenceRate: `${overallAdherenceRate}%`,
      adherenceRateThisWeek: `${adherenceThisWeek}%`,
      adherenceRateThisMonth: `${adherenceThisMonth}%`,
      adherenceRateIncrementThisWeek: `${adherenceIncrementThisWeek >= 0 ? '+' : ''}${adherenceIncrementThisWeek}%`,
      adherenceRateIncrementThisMonth: `${adherenceIncrementThisMonth >= 0 ? '+' : ''}${adherenceIncrementThisMonth}%`,
    },
  };
}
