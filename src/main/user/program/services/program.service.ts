import { Injectable } from '@nestjs/common';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { DateTime } from 'luxon';

@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch currently assigned program')
  async getCurrentlyAssignedProgram(userId: string): Promise<TResponse<any>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Get current date/time in user's timezone
    const userTimezone = user.timezone || 'UTC';
    const currentDateTime = DateTime.now().setZone(userTimezone);

    // Find the user's currently in-progress program
    const userProgram = await this.prisma.userProgram.findFirst({
      where: {
        userId,
        status: 'IN_PROGRESS',
        startDate: { lte: currentDateTime.toJSDate() },
        endDate: { gte: currentDateTime.toJSDate() },
      },
      include: {
        program: {
          include: {
            exercises: true,
          },
        },
      },
    });

    if (!userProgram) {
      throw new AppError(404, 'No currently assigned program found');
    }

    // Calculate difference in days between current date and program start date
    const startDate = DateTime.fromJSDate(userProgram.startDate).setZone(
      userTimezone,
    );
    const diffInDays = currentDateTime
      .startOf('day')
      .diff(startDate.startOf('day'), 'days').days;
    const dayNumber = Math.floor(diffInDays) + 1; // 1-based index
    const weekNumber = Math.ceil(dayNumber / 7);

    // Fetch today's exercises
    const todaysExercises = await this.prisma.userProgramExercise.findMany({
      where: {
        userProgramId: userProgram.id,
        dayNumber,
      },
      include: { programExercise: true },
    });

    const formattedOutput = {
      id: userProgram.id,
      startDate: userProgram.startDate,
      endDate: userProgram.endDate,
      status: userProgram.status,
      dayNumber,
      weekNumber,
      todaysExercises,
      user: {
        userId: userProgram.userId,
        timezone: userTimezone,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        name: user.name,
      },
      program: {
        programId: userProgram.programId,
        programName: userProgram.program.name,
        programDescription: userProgram.program.description,
        programDuration: `${userProgram.program.duration} weeks`,
      },
      analytics: {
        trainingCompleted: '22/66', // Total exercises completed / total exercises in program
        progressTracking: {
          currentWeek: weekNumber,
          totalWeeks: Math.ceil(userProgram.program.duration / 7),
          percentageCompleted: Math.round(
            (weekNumber / Math.ceil(userProgram.program.duration / 7)) * 100,
          ),
          complianceScore: 85, // Example compliance score
        },
        loadProgression: {
          initialLoad: 50, // Example initial load
          currentLoad: 75, // Example current load
          targetLoad: 100, // Example target load
          progressionRate: Math.round(((75 - 50) / (100 - 50)) * 100),
        },
        rpeTrends: {
          averageRPE: 7, // Example average RPE
          rpeOverTime: [
            { week: 1, averageRPE: 6 },
            { week: 2, averageRPE: 7 },
            { week: 3, averageRPE: 8 },
          ],
        },
      },
    };

    return successResponse(
      formattedOutput,
      'Currently assigned program fetched successfully',
    );
  }
}
