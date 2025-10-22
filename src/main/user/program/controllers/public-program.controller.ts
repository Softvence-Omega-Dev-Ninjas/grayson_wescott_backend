import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { PublicProgramService } from '../services/public-program.service';

@ApiTags('User -- Public Program')
@Controller('public-program')
export class PublicProgramController {
  constructor(private readonly publicProgramService: PublicProgramService) {}

  @ApiOperation({ summary: 'Get all programs' })
  @Get()
  async getAllPrograms(@Query() query: PaginationDto) {
    return this.publicProgramService.getAllPrograms(query);
  }

  @ApiOperation({ summary: 'Get a program' })
  @Get(':id')
  async getProgram(@Param('id') id: string) {
    return this.publicProgramService.getProgram(id);
  }
}
