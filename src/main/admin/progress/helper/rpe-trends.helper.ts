import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export interface RpeTrend {
  day: string; // Monday, Tuesday, etc
  date: string; // ISO date
  rpe: number; // average RPE
}

export async function getLastNDaysRpeTrends(
  prisma: PrismaClient,
): Promise<RpeTrend[]> {
  const now = DateTime.now().startOf('day');
  const startDay = now.minus({ days: 9 });

  // Fetch completed exercises in the period
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

  // Initialize map for each day
  const logsByDay: Record<string, any[]> = {};
  for (let i = 0; i < 10; i++) {
    const dateKey = startDay.plus({ days: i }).toISODate();
    logsByDay[dateKey] = [];
  }

  // Group logs by completed day
  logs.forEach((log) => {
    const dateKey = DateTime.fromJSDate(log.completedAt!).toISODate() || '';
    if (logsByDay[dateKey]) {
      logsByDay[dateKey].push(log);
    }
  });

  // Compute RPE: proxy using sets × reps × duration
  const computeRpe = (log: any): number => {
    const sets = log.programExercise?.sets ?? 0;
    const reps = log.programExercise?.reps ?? 0;
    const duration = log.programExercise?.duration ?? 0;
    if (sets === 0 || reps === 0 || duration === 0) return 0;

    // Scale to 1-10 for simplicity
    return Math.min(10, Math.round((sets * reps * duration) / 50));
  };

  // Compute average RPE per day
  const rpeTrend: RpeTrend[] = Object.entries(logsByDay).map(
    ([date, dayLogs]) => {
      const scores = dayLogs.map(computeRpe);
      const avgRpe = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
      return {
        day: DateTime.fromISO(date).toFormat('cccc'),
        date,
        rpe: Number(avgRpe.toFixed(1)),
      };
    },
  );

  return rpeTrend;
}
