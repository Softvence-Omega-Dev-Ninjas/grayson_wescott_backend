import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class GetCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by program name',
    example: 'My Program',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
