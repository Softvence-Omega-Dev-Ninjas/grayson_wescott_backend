import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getClientStats(prisma: PrismaClient) {
  const now = DateTime.now();
  const startOfWeek = now.startOf('week').toJSDate();
  const startOfMonth = now.startOf('month').toJSDate();

  const totalClients = await prisma.user.count({ where: { role: 'USER' } });

  const activeClients = await prisma.user.count({
    where: { role: 'USER', status: 'ACTIVE' },
  });

  const addedThisMonth = await prisma.user.count({
    where: { createdAt: { gte: startOfMonth } },
  });

  const addedThisWeek = await prisma.user.count({
    where: { createdAt: { gte: startOfWeek } },
  });

  return {
    totalClients,
    activeClients,
    addedThisMonth,
    addedThisWeek,
  };
}
