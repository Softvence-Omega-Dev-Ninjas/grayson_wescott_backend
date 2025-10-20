import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsOptional, IsString } from 'class-validator';

export class GetLibraryExerciseDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'My Exercise' })
  @IsOptional()
  @IsString()
  search?: string;
}
