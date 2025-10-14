import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function computeLoadProgression(
  prisma: PrismaClient,
  userTimezone = 'UTC',
) {
  const now = DateTime.now().setZone(userTimezone);

  // ✅ last 7 weeks including current (6 weeks ago → this week)
  const startWeek = now.startOf('week').minus({ weeks: 6 });
  const endWeek = now.endOf('week');

  // Fetch all user programs with exercises & logs
  const userPrograms = await prisma.userProgram.findMany({
    include: {
      program: { include: { exercises: true } },
      userProgramExercise: {
        include: { programExercise: true },
      },
    },
  });

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

  // Prepare week buckets (7 total)
  const weekBuckets = new Map<string, { planned: number; completed: number }>();
  for (
    let w = startWeek.startOf('week');
    w <= endWeek.startOf('week');
    w = w.plus({ weeks: 1 })
  ) {
    weekBuckets.set(w?.toISODate() ?? '', { planned: 0, completed: 0 });
  }

  // Iterate user programs
  for (const up of userPrograms) {
    const program = up.program;
    if (!program || !up.startDate) continue;
    const template = program.exercises ?? [];

    const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);
    const weeks =
      program.duration && program.duration > 0 ? program.duration : 1;
    const endDate = startDate.plus({ weeks }).minus({ days: 1 });

    // Planned load
    for (
      let d = startDate.startOf('day');
      d <= endDate.startOf('day');
      d = d.plus({ days: 1 })
    ) {
      const weekdayEnum = weekdayToEnum(d.weekday);
      const bucketKey = d.startOf('week').toISODate() as string;
      for (const ex of template) {
        if (ex?.dayOfWeek === weekdayEnum && weekBuckets.has(bucketKey)) {
          weekBuckets.get(bucketKey)!.planned += ex.duration ?? 0;
        }
      }
    }

    // Completed load
    for (const log of up.userProgramExercise ?? []) {
      if (log.status !== 'COMPLETED' || !log.completedAt) continue;
      const completedAt = DateTime.fromJSDate(log.completedAt).setZone(
        userTimezone,
      );
      const bucketKey = completedAt.startOf('week').toISODate() as string;
      if (weekBuckets.has(bucketKey)) {
        weekBuckets.get(bucketKey)!.completed +=
          log.programExercise?.duration ?? 0;
      }
    }
  }

  // ✅ Format output sorted oldest → newest
  const chartData = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, { planned, completed }]) => {
      const weekStartDT = DateTime.fromISO(weekStart).setZone(userTimezone);
      const weekEndDT = weekStartDT.endOf('week');
      const label = `${weekStartDT.toFormat('MMM d')}–${weekEndDT.toFormat('d')}`;
      return {
        weekStart,
        label,
        planned,
        completed,
      };
    });

  return {
    range: {
      from: startWeek.toISODate(),
      to: endWeek.toISODate(),
    },
    chartData,
  };
}
