import { Injectable } from '@nestjs/common';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class SingleClientAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
}
