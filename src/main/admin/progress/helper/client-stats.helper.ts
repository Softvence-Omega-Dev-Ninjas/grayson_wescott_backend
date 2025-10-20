import { Prisma, PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

export async function getClientStats(prisma: PrismaClient) {
  const now = DateTime.now();
  const startOfWeek = now.startOf('week').toJSDate();
  const startOfMonth = now.startOf('month').toJSDate();

  // Base Filters
  const baseUserFilter: Prisma.UserWhereInput = { role: 'USER' };
  const monthlyFilter: Prisma.UserWhereInput = {
    ...baseUserFilter,
    createdAt: { gte: startOfMonth },
  };
  const weeklyFilter: Prisma.UserWhereInput = {
    ...baseUserFilter,
    createdAt: { gte: startOfWeek },
  };
  const activeFilter: Prisma.UserWhereInput = {
    ...baseUserFilter,
    status: 'ACTIVE',
  };

  // Counts
  const totalClients = await prisma.user.count({ where: baseUserFilter });
  const addedThisMonth = await prisma.user.count({ where: monthlyFilter });
  const addedThisWeek = await prisma.user.count({ where: weeklyFilter });

  const activeClients = await prisma.user.count({ where: activeFilter });
  const activeClientsThisMonth = await prisma.user.count({
    where: { ...monthlyFilter, status: 'ACTIVE' },
  });
  const activeClientsThisWeek = await prisma.user.count({
    where: { ...weeklyFilter, status: 'ACTIVE' },
  });

  return {
    totalClients,
    addedThisMonth,
    addedThisMonthPercentage: totalClients
      ? (addedThisMonth / totalClients) * 100
      : 0,

    addedThisWeek,

    activeClients,
    activeClientsThisMonth,
    activeClientsThisMonthPercentage: addedThisMonth
      ? (activeClientsThisMonth / addedThisMonth) * 100
      : 0,

    activeClientsThisWeek,
  };
}
