import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TResponse } from '@project/common/utils/response.util';
import { HyperhumanService } from '@project/lib/hyperhuman/hyperhuman.service';
import { CreateLibraryExerciseDto } from './dto/create-library-exercise.dto';
import { GetLibraryExerciseDto } from './dto/get-library-exercise.dto';
import { GetWorkoutsFromHyperhumanDto } from './dto/get-workouts-from-hyperhuman.dto';
import { CreateExerciseService } from './services/create-exercise.service';
import { GetLibraryExerciseService } from './services/get-library-exercise.service';

@ApiTags('Admin --- Exercises Library')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('library')
export class LibraryController {
  constructor(
    private readonly createExerciseService: CreateExerciseService,
    private readonly hyperhuman: HyperhumanService,
    private readonly getLibraryExerciseService: GetLibraryExerciseService,
  ) {}

  @ApiOperation({ summary: 'Get library exercises' })
  @Get()
  async getLibraryExercises(@Query() query: GetLibraryExerciseDto) {
    return this.getLibraryExerciseService.getExerciseLibrary(query);
  }

  @ApiOperation({ summary: 'Get single library exercise' })
  @Get(':id')
  async getSingleLibraryExercise(@Param('id') id: string) {
    return this.getLibraryExerciseService.getSingleExercise(id);
  }

  @ApiOperation({ summary: 'Get workouts from Hyperhuman' })
  @Get('workouts/hyperhuman')
  async getWorkoutsFromHyperhuman(
    @Query() query: GetWorkoutsFromHyperhumanDto,
  ): Promise<TResponse<any>> {
    return this.hyperhuman.getWorkoutsFromHyperhuman(query);
  }

  @ApiOperation({ summary: 'Create a library exercise' })
  @Post()
  async createLibraryExercise(
    @Body() data: CreateLibraryExerciseDto,
  ): Promise<TResponse<any>> {
    return this.createExerciseService.createExercise(data);
  }
}
