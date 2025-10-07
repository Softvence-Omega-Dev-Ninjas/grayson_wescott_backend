import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { CreateCategoryDto, GetCategoriesDto } from '../dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to create category', 'CATEGORY')
  async createCategory(data: CreateCategoryDto): Promise<TResponse<any>> {
    // * check if name already exists
    const existingCategory = await this.prisma.category.findUnique({
      where: {
        name: data.name,
      },
    });

    if (existingCategory) {
      throw new AppError(404, 'Category name already exists');
    }

    const category = await this.prisma.category.create({
      data,
    });

    return successResponse(category, 'Category created successfully');
  }

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

  @HandleError('Failed to delete category', 'CATEGORY')
  async deleteCategory(id: string): Promise<TResponse<any>> {
    await this.prisma.category.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.category.delete({ where: { id } });
    return successResponse(null, 'Category deleted successfully');
  }
}
