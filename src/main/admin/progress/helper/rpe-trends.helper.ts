import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export interface RpeTrend {
  day: string; // e.g. Monday, Tuesday
  date: string; // ISO date
  rpe: number; // average RPE
}

export async function getLastNDaysRpeTrends(
  prisma: PrismaClient,
): Promise<RpeTrend[]> {
  const now = DateTime.now().startOf('day');
  const startDay = now.minus({ days: 6 }); // 6 days ago + today = 7 total

  // Fetch completed exercises in this range
  const logs = await prisma.userProgramExercise.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: {
        gte: startDay.toJSDate(),
        lte: now.endOf('day').toJSDate(),
      },
    },
    include: {
      programExercise: true,
    },
  });

  // Prepare a map for each day
  const logsByDay: Record<string, any[]> = {};
  for (let i = 0; i < 7; i++) {
    const dateKey = startDay.plus({ days: i }).toISODate();
    logsByDay[dateKey] = [];
  }

  // Group logs by day of completion
  logs.forEach((log) => {
    const dateKey = DateTime.fromJSDate(log.completedAt!).toISODate() as string;
    if (logsByDay[dateKey]) {
      logsByDay[dateKey].push(log);
    }
  });

  // Compute RPE (simple intensity metric)
  const computeRpe = (log: any): number => {
    const sets = log.programExercise?.sets ?? 0;
    const reps = log.programExercise?.reps ?? 0;
    const duration = log.programExercise?.duration ?? 0;
    if (!sets || !reps || !duration) return 0;

    // Scale to 1–10 for visualization
    return Math.min(10, Math.round((sets * reps * duration) / 50));
  };

  // Calculate daily averages (oldest → newest)
  const rpeTrend: RpeTrend[] = Object.entries(logsByDay).map(
    ([date, dayLogs]) => {
      const scores = dayLogs.map(computeRpe);
      const avgRpe = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      return {
        day: DateTime.fromISO(date).toFormat('ccc'), // Mon, Tue, etc
        date,
        rpe: Number(avgRpe.toFixed(1)),
      };
    },
  );

  return rpeTrend;
}
