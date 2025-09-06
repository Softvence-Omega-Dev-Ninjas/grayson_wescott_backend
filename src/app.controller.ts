import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor() {}

  // @Get()
  // @ApiOkResponse({
  //   description: 'Returns service health status',
  //   schema: {
  //     example: {
  //       status: 'ok',
  //       timestamp: '2025-05-27T12:00:00.000Z',
  //     },
  //   },
  // })
  // getHealth(): { status: string; timestamp: string } {
  //   return {
  //     status: 'ok',
  //     timestamp: new Date().toISOString(),
  //   };
  // }
}
