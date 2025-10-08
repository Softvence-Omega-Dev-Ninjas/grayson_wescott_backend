import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetAllClientsDto extends PaginationDto {
  @ApiPropertyOptional({
    example: UserStatus.ACTIVE,
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  search?: string;
}
