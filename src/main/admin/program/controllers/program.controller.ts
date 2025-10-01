import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import {
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { AddProgramDto } from '../dto/add-program.dto';
import { GetProgramsDto } from '../dto/get-programs.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';
import { AddProgramService } from '../services/add-program.service';
import { ProgramService } from '../services/program.service';
import { UpdateProgramService } from '../services/update-program.service';

@ApiTags('Admin --- Program')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('program')
export class ProgramController {
  constructor(
    private readonly addProgramService: AddProgramService,
    private readonly updateProgramService: UpdateProgramService,
    private readonly programService: ProgramService,
  ) {}

  @ApiOperation({ summary: 'Add program' })
  @Post()
  async addProgramme(@Body() dto: AddProgramDto): Promise<TResponse<any>> {
    return this.addProgramService.addProgramme(dto);
  }

  @ApiOperation({ summary: 'Get programs' })
  @Get()
  async getPrograms(
    @Query() dto: GetProgramsDto,
  ): Promise<TPaginatedResponse<any>> {
    return this.programService.getPrograms(dto);
  }

  @ApiOperation({ summary: 'Get program' })
  @Get(':id')
  async getProgram(@Param('id') id: string): Promise<TResponse<any>> {
    return this.programService.getProgram(id);
  }

  @ApiOperation({ summary: 'Update program' })
  @Patch(':id')
  async updateProgramme(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
  ): Promise<TResponse<any>> {
    return this.updateProgramService.updateProgram(id, dto);
  }

  @ApiOperation({ summary: 'Delete program' })
  @Delete(':id')
  async deleteProgram(@Param('id') id: string): Promise<TResponse<any>> {
    return this.programService.deleteProgram(id);
  }
}
