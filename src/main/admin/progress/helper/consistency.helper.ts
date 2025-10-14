import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export interface WeeklyConsistency {
  label: string;
  weekStart: string; // ISO date of week start (Monday)
  weekEnd: string; // ISO date of week end (Sunday)
  consistencyPercent: number; // 0-100
}

export async function getLastNWeeksConsistency(
  prisma: PrismaClient,
  weeks = 7, // default 7 weeks including current
): Promise<WeeklyConsistency[]> {
  const now = DateTime.now().startOf('day');
  const results: WeeklyConsistency[] = [];

  // oldest → newest (e.g., 6 weeks ago → current week)
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = now.minus({ weeks: i }).startOf('week'); // Monday
    const weekEnd = weekStart.endOf('week'); // Sunday

    const scheduledExercises = await prisma.userProgramExercise.findMany({
      where: {
        dayNumber: { gte: 1 },
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

    // Label example: "Oct 7–13"
    const label = `${weekStart.toFormat('MMM d')}–${weekEnd.toFormat('d')}`;

    results.push({
      label,
      weekStart: weekStart.toISODate(),
      weekEnd: weekEnd.toISODate(),
      consistencyPercent,
    });
  }

  return results;
}
