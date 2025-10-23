import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { Public, ValidateAdmin } from '@project/common/jwt/jwt.decorator';
import { CreateContactFormDto } from './dto/create-contact.dto';
import { ContactService } from './services/contact.service';
import { CreateContactService } from './services/create-contact.service';

@ApiTags('Contact')
@ApiBearerAuth()
@ValidateAdmin()
@Controller('contact')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
    private readonly createContactService: CreateContactService,
  ) {}

  @ApiOperation({ summary: 'Create contact/ Send message to super admin' })
  @Public()
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB Max
    }),
  )
  create(
    @Body() dto: CreateContactFormDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.createContactService.createContact(dto, file);
  }

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
