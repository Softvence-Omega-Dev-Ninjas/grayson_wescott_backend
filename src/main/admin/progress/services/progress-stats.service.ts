import { Injectable } from '@nestjs/common';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class ProgressStatsService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch progress stats')
  async getProgressStats(): Promise<TResponse<any>> {
    const outPutData = {
      clients: {
        activeClients: 40,
        addedThisMonth: 10,
        addedThisWeek: 5,
      },
      program: {
        totalPrograms: 15,
        activePrograms: 10,
        programsAddedThisMonth: 3,
        programsAddedThisWeek: 1,
      },
      completion: {
        avgProgramCompletionRate: '65%',
        completionRateIncrementThisWeek: '5%',
        completionRateIncrementThisMonth: '8%',
      },
      adherenceCompletion: {
        overallAdherenceRate: '70%',
        adherenceRateThisWeek: '75%',
        adherenceRateThisMonth: '72%',
      },
      workout: {
        totalWorkoutsLogged: 500,
        completedWorkouts: 350,
        completedToday: 20,
        completedThisWeek: 100,
        completedThisMonth: 200,
      },
    };

    return successResponse(outPutData, 'Progress stats fetched successfully');
  }
}
