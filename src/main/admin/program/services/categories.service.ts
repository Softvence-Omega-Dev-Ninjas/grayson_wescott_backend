import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  TPaginatedResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { GetCategoriesDto } from '../dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to get categories', 'CATEGORIES')
  async getCategories(
    query: GetCategoriesDto,
  ): Promise<TPaginatedResponse<any>> {
    const page = query.page && +query.page > 0 ? +query.page : 1;
    const limit = query.limit && +query.limit > 0 ? +query.limit : 10;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();

    const where: Prisma.CategoryWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({ where, take: limit, skip }),
      this.prisma.category.count(),
    ]);

    return successPaginatedResponse(
      categories,
      {
        page,
        limit,
        total,
      },
      'Categories fetched successfully',
    );
  }
}
