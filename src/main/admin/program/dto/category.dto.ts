import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class GetCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by category name',
    example: 'My Category',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'My Category',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'This is my category',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
