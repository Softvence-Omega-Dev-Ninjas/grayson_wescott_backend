import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetUser, ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { ProgramService } from '../services/program.service';

@ApiTags('Client --- Program')
@ApiBearerAuth()
@ValidateAuth()
@Controller('program/user')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @ApiOperation({ summary: 'Get Currently Assigned Program' })
  @Get('currently-assigned')
  async getCurrentlyAssignedProgram(@GetUser('sub') userId: string) {
    return this.programService.getCurrentlyAssignedProgram(userId);
  }
}
