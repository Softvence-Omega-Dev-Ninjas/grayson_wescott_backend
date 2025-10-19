import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TResponse } from '@project/common/utils/response.util';
import { CreateLibraryExerciseDto } from './dto/create-library-exercise.dto';
import { CreateExerciseService } from './services/create-exercise.service';

@ApiTags('Admin --- Exercises Library')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('library')
export class LibraryController {
  constructor(private readonly createExerciseService: CreateExerciseService) {}

  @ApiOperation({ summary: 'Create a library exercise' })
  @Post()
  async createLibraryExercise(
    @Body() data: CreateLibraryExerciseDto,
  ): Promise<TResponse<any>> {
    return this.createExerciseService.createExercise(data);
  }
}
