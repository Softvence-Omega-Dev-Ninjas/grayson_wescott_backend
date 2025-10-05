import type { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function computeLoadProgression(
  prisma: PrismaClient,
  userTimezone = 'UTC',
) {
  const now = DateTime.now().setZone(userTimezone);

  const startWeek = now.startOf('week').minus({ weeks: 8 });
  const endWeek = now.endOf('week').plus({ weeks: 1 });

  // load all userPrograms with program templates & logs
  const userPrograms = await prisma.userProgram.findMany({
    include: {
      program: { include: { exercises: true } },
      userProgramExercise: {
        include: { programExercise: true },
      },
    },
  });

  // helper: map Luxon weekday to enum string
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

  // prepare buckets: weekStartISO => { planned, completed }
  const weekBuckets = new Map<string, { planned: number; completed: number }>();

  for (
    let w = startWeek.startOf('week');
    w <= endWeek.startOf('week');
    w = w.plus({ weeks: 1 })
  ) {
    weekBuckets.set(w?.toISODate() ?? '', { planned: 0, completed: 0 });
  }

  for (const up of userPrograms) {
    const program = up.program;
    if (!program || !up.startDate) continue;
    const template = program.exercises ?? [];

    const startDate = DateTime.fromJSDate(up.startDate).setZone(userTimezone);
    const weeks =
      program.duration && program.duration > 0 ? program.duration : 1;
    const endDate = startDate.plus({ weeks }).minus({ days: 1 });

    // iterate each day in program window
    for (
      let d = startDate.startOf('day');
      d <= endDate.startOf('day');
      d = d.plus({ days: 1 })
    ) {
      const weekdayEnum = weekdayToEnum(d.weekday);
      const bucketKey = d.startOf('week')?.toISODate() || '';

      for (const ex of template) {
        if (!ex?.dayOfWeek) continue;
        if (ex.dayOfWeek === weekdayEnum) {
          if (weekBuckets.has(bucketKey)) {
            weekBuckets.get(bucketKey)!.planned += ex.duration ?? 0;
          }
        }
      }
    }

    // logs
    const logs = up.userProgramExercise ?? [];
    for (const log of logs) {
      if (log.status !== 'COMPLETED' || !log.completedAt) continue;
      const completedAt = DateTime.fromJSDate(log.completedAt).setZone(
        userTimezone,
      );
      const bucketKey = completedAt.startOf('week').toISODate() || '';
      if (weekBuckets.has(bucketKey)) {
        weekBuckets.get(bucketKey)!.completed +=
          log.programExercise?.duration ?? 0;
      }
    }
  }

  // format output sorted by week
  const chartData = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, { planned, completed }], i) => {
      const weekLabel = `Week ${i + 1}`;
      return {
        weekStart,
        label: weekLabel,
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
