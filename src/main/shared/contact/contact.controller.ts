import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { ContactService } from './services/contact.service';

@ApiTags('Contact')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({ summary: 'Get all contacts' })
  @Get()
  findAll(@Query() pg: PaginationDto) {
    return this.contactService.findAll(pg);
  }

  @ApiOperation({ summary: 'Get one contact' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }
}
