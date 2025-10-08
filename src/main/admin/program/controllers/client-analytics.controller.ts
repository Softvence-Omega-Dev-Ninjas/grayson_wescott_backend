import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TPaginatedResponse } from '@project/common/utils/response.util';
import { GetAllClientsDto } from '../dto/get-client.dto';
import { ClientAnalyticsService } from '../services/client-analytics.service';

@ApiTags('Admin --- Client Analytics')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('client-analytics')
export class ClientAnalyticsController {
  constructor(
    private readonly clientAnalyticsService: ClientAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Get All Client Analytics' })
  @Get()
  async getAllClientAnalytics(
    @Query() query: GetAllClientsDto,
  ): Promise<TPaginatedResponse<any>> {
    return await this.clientAnalyticsService.getAllClientAnalytics(query);
  }
}
