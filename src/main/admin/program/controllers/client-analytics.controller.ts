import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { TPaginatedResponse } from '@project/common/utils/response.util';
import {
  GetAllClientsDto,
  SingleClientAnalyticsDto,
} from '../dto/get-client.dto';
import { ClientAnalyticsService } from '../services/client-analytics.service';
import { SingleClientAnalyticsService } from '../services/single-client-analytics.service';

@ApiTags('Admin --- Client Analytics')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('client-analytics')
export class ClientAnalyticsController {
  constructor(
    private readonly clientAnalyticsService: ClientAnalyticsService,
    private readonly singleClientAnalyticsService: SingleClientAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Get All Client Analytics' })
  @Get()
  async getAllClientAnalytics(
    @Query() query: GetAllClientsDto,
  ): Promise<TPaginatedResponse<any>> {
    return await this.clientAnalyticsService.getAllClientAnalytics(query);
  }

  @ApiOperation({ summary: 'Get Single Client Analytics' })
  @Get(':userId')
  async getSingleClientAnalytics(
    @Param('userId') userId: string,
    @Query() query: SingleClientAnalyticsDto,
  ) {
    return await this.singleClientAnalyticsService.getSingleClientAnalytics(
      userId,
      query,
    );
  }
}
