import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getProgramStats(prisma: PrismaClient) {
  const now = DateTime.now();
  const startOfWeek = now.startOf('week').toJSDate();
  const startOfMonth = now.startOf('month').toJSDate();

  const totalPrograms = await prisma.program.count();
  const activePrograms = await prisma.program.count({
    where: { status: 'PUBLISHED' },
  });

  const programsAddedThisMonth = await prisma.program.count({
    where: { createdAt: { gte: startOfMonth } },
  });

  const programsAddedThisWeek = await prisma.program.count({
    where: { createdAt: { gte: startOfWeek } },
  });

  return {
    totalPrograms,
    activePrograms,
    programsAddedThisMonth,
    programsAddedThisWeek,
  };
}
