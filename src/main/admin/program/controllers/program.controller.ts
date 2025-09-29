import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TResponse } from '@project/common/utils/response.util';
import { AddProgramDto } from '../dto/add-program.dto';
import { AddProgramService } from '../services/add-program.service';

@ApiTags('Program')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('program')
export class ProgramController {
  constructor(private readonly addProgramService: AddProgramService) {}

  @Post('add')
  async addProgramme(@Body() dto: AddProgramDto): Promise<TResponse<any>> {
    return this.addProgramService.addProgramme(dto);
  }
}
