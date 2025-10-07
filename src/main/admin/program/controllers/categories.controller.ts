import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TPaginatedResponse } from '@project/common/utils/response.util';
import { CreateCategoryDto, GetCategoriesDto } from '../dto/category.dto';
import { CategoriesService } from '../services/categories.service';

@ApiTags('Admin --- Categories')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Create category' })
  @Post()
  createCategory(@Body() data: CreateCategoryDto) {
    return this.categoriesService.createCategory(data);
  }

  @ApiOperation({ summary: 'Get all categories' })
  @Get()
  getCategories(
    @Query() query: GetCategoriesDto,
  ): Promise<TPaginatedResponse<any>> {
    return this.categoriesService.getCategories(query);
  }

  @ApiOperation({ summary: 'Delete category' })
  @Delete(':id')
  deleteCategory(@Param('id') id: string) {
    return this.categoriesService.deleteCategory(id);
  }
}
