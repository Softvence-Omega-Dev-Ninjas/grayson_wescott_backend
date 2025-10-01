import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ValidateAuth } from '@project/common/jwt/jwt.decorator';
import { ProgramService } from '../services/program.service';

@ApiTags('Client --- Program')
@ApiBearerAuth()
@ValidateAuth()
@Controller('program')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}
}
