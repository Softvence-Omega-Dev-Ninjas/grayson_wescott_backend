import { Injectable } from '@nestjs/common';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successPaginatedResponse,
  successResponse,
  TPaginatedResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  @HandleError('Failed to fetch contacts', 'Contacts')
  async findAll(pg: PaginationDto): Promise<TPaginatedResponse<any>> {
    const page = pg.page && +pg.page > 0 ? +pg.page : 1;
    const limit = pg.limit && +pg.limit > 0 ? +pg.limit : 10;
    const skip = (page - 1) * limit;

    const [contacts, total] = await this.prisma.$transaction([
      this.prisma.contactForm.findMany({ take: limit, skip }),
      this.prisma.contactForm.count(),
    ]);

    return successPaginatedResponse(
      contacts,
      {
        page,
        limit,
        total,
      },
      'Contacts fetched successfully',
    );
  }

  @HandleError('Failed to fetch contact', 'Contact')
  async findOne(id: string): Promise<TResponse<any>> {
    const contact = await this.prisma.contactForm.findUniqueOrThrow({
      where: { id },
    });

    return successResponse(contact, 'Contact fetched successfully');
  }
}
