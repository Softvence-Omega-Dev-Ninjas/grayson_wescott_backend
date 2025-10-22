import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class PublicProgramService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get all programs', 'Programs')
  async getAllPrograms(pg: PaginationDto): Promise<TPaginatedResponse<any>> {
    const page = pg.page && +pg.page > 0 ? +pg.page : 1;
    const limit = pg.limit && +pg.limit > 0 ? +pg.limit : 10;

    const skip = (page - 1) * limit;

    const [programs, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { exercises: true },
      }),
      this.prisma.program.count(),
    ]);

    const formattedOutput = programs.map((program) => {
      return {
        id: program.id,
        name: program.name,
        description: program.description,
        coachNote: program.coachNote,
        duration: program.duration,
        exercisesTitles: program.exercises.map((e) => e.title).slice(0, 7),
      };
    });

    return successPaginatedResponse(
      formattedOutput,
      {
        page,
        limit,
        total,
      },
      'Programs found successfully',
    );
  }

  @HandleError('Failed to get program', 'Program')
  async getProgram(id: string): Promise<TResponse<any>> {
    const program = await this.prisma.program.findUniqueOrThrow({
      where: { id },
      include: {
        exercises: true,
        programCategories: { include: { category: true } },
      },
    });

    // Format the output
    const formattedOutput = {
      id: program.id,
      name: program.name,
      description: program.description,
      coachNote: program.coachNote,
      duration: program.duration,
      exercises: program.exercises, // full exercise objects
      categories: program.programCategories.map((pc) => pc.category.name), // only names
    };

    return successResponse(formattedOutput, 'Program found successfully');
  }
}
