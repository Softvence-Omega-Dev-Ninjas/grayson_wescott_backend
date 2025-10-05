import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export interface WeeklyConsistency {
  weekStart: string; // ISO date of week start (Monday)
  weekEnd: string; // ISO date of week end (Sunday)
  consistencyPercent: number; // 0-100
}

export async function getLastNWeeksConsistency(
  prisma: PrismaClient,
  weeks = 10,
): Promise<WeeklyConsistency[]> {
  const now = DateTime.now().startOf('day');

  const result: WeeklyConsistency[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    // Determine start and end of the week
    const weekStart = now.minus({ weeks: i }).startOf('week'); // Monday
    const weekEnd = weekStart.endOf('week'); // Sunday

    // Fetch user program exercises scheduled for this week (from userProgram)
    const scheduledExercises = await prisma.userProgramExercise.findMany({
      where: {
        dayNumber: { gte: 1 }, // all assigned exercises
        createdAt: { lte: weekEnd.toJSDate() },
      },
      include: { programExercise: true },
    });

    const completedExercises = scheduledExercises.filter(
      (e) =>
        e.status === 'COMPLETED' &&
        e.completedAt &&
        DateTime.fromJSDate(e.completedAt).toMillis() >= weekStart.toMillis() &&
        DateTime.fromJSDate(e.completedAt).toMillis() <= weekEnd.toMillis(),
    );

    const totalScheduled = scheduledExercises.length;
    const totalCompleted = completedExercises.length;

    const consistencyPercent =
      totalScheduled > 0
        ? Math.min(100, Math.round((totalCompleted / totalScheduled) * 100))
        : 0;

    result.push({
      weekStart: weekStart.toISODate(),
      weekEnd: weekEnd.toISODate(),
      consistencyPercent,
    });
  }

  return result;
}
