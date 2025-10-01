import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TResponse } from '@project/common/utils/response.util';
import { AddProgramDto } from '../dto/add-program.dto';
import { UpdateProgramDto } from '../dto/update-program.dto';
import { AddProgramService } from '../services/add-program.service';
import { UpdateProgramService } from '../services/update-program.service';

@ApiTags('Program')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('program')
export class ProgramController {
  constructor(
    private readonly addProgramService: AddProgramService,
    private readonly updateProgramService: UpdateProgramService,
  ) {}

  @ApiOperation({ summary: 'Add program' })
  @Post('add')
  async addProgramme(@Body() dto: AddProgramDto): Promise<TResponse<any>> {
    return this.addProgramService.addProgramme(dto);
  }

  @ApiOperation({ summary: 'Update program' })
  @Post('update')
  async updateProgramme(
    @Body() dto: UpdateProgramDto,
  ): Promise<TResponse<any>> {
    return this.updateProgramService.updateProgram(dto);
  }
}
