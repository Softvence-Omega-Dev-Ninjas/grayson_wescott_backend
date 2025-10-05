import { DateTime } from 'luxon';

export type DayOfWeekEnum =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export function weekdayToEnum(weekday: number): DayOfWeekEnum {
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
  return map[weekday] as DayOfWeekEnum;
}

/**
 * Compute template derived metrics:
 * - scheduledCountUpToDate, plannedLoadUpToDate, plannedVolumeUpToDate (from start->today)
 * - totalPlannedExercisesFull, totalPlannedLoadFull, totalPlannedVolumeFull (full program)
 */
export function computeTemplateMetrics(
  templateExercises: any[],
  startDate: DateTime | null,
  daysToCount: number,
  programWeeks: number,
) {
  let scheduledCountUpToDate = 0;
  let plannedLoadUpToDate = 0;
  let plannedVolumeUpToDate = 0;

  // up-to-date calculation (start -> today)
  if (startDate && daysToCount > 0 && templateExercises.length > 0) {
    for (let offset = 0; offset < daysToCount; offset++) {
      const date = startDate.plus({ days: offset });
      const weekdayEnum = weekdayToEnum(date.weekday);

      for (const te of templateExercises) {
        if (!te || !te.dayOfWeek) continue;
        if (te.dayOfWeek === weekdayEnum) {
          scheduledCountUpToDate += 1;
          plannedLoadUpToDate += te.duration ?? 0;
          if (te.sets && te.reps) {
            plannedVolumeUpToDate += te.sets * te.reps;
          }
        }
      }
    }
  }

  // full-plan (entire program) calculations
  // weekly aggregates
  let weeklyExerciseCount = 0;
  let weeklyLoad = 0;
  let weeklyVolume = 0;
  for (const te of templateExercises) {
    weeklyExerciseCount += 1;
    weeklyLoad += te.duration ?? 0;
    if (te.sets && te.reps) weeklyVolume += te.sets * te.reps;
  }

  const totalPlannedExercisesFull = weeklyExerciseCount * (programWeeks || 1);
  const totalPlannedLoadFull = weeklyLoad * (programWeeks || 1);
  const totalPlannedVolumeFull = weeklyVolume * (programWeeks || 1);

  return {
    scheduledCountUpToDate,
    plannedLoadUpToDate,
    plannedVolumeUpToDate,
    totalPlannedExercisesFull,
    totalPlannedLoadFull,
    totalPlannedVolumeFull,
  };
}

/**
 * Compute completed metrics from logs (status === 'COMPLETED')
 */
export function computeCompletedMetrics(logs: any[]) {
  const completedLogs = (logs ?? []).filter((e) => e?.status === 'COMPLETED');

  const completedCount = completedLogs.length;
  const completedLoad = completedLogs.reduce(
    (s, e) => s + (e.programExercise?.duration ?? 0),
    0,
  );
  const completedVolume = completedLogs.reduce((s, e) => {
    const reps = e.programExercise?.reps ?? 0;
    const sets = e.programExercise?.sets ?? 0;
    return s + (reps > 0 && sets > 0 ? reps * sets : 0);
  }, 0);

  return { completedCount, completedLoad, completedVolume };
}

export function formatMinutes(mins: number) {
  if (!mins || mins <= 0) return '0 mins';
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes} mins`;
  if (minutes === 0) return `${hours} hrs`;
  return `${hours} hrs ${minutes} mins`;
}
