import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getClientStats(prisma: PrismaClient) {
  const now = DateTime.now();
  const startOfWeek = now.startOf('week').toJSDate();
  const startOfMonth = now.startOf('month').toJSDate();

  const activeClients = await prisma.user.count();

  const addedThisMonth = await prisma.user.count({
    where: { createdAt: { gte: startOfMonth } },
  });

  const addedThisWeek = await prisma.user.count({
    where: { createdAt: { gte: startOfWeek } },
  });

  return {
    activeClients,
    addedThisMonth,
    addedThisWeek,
  };
}
