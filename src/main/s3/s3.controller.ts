import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as multer from 'multer';
import { S3Service } from './s3.service';

@ApiTags('File Uploads (S3)')
@Controller('uploads')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @ApiOperation({ summary: 'Upload multiple OR single files to S3' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multer.memoryStorage(),
      limits: { files: 10 },
    }),
  )
  async upload(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file(s) uploaded');
    }

    if (files.length > 10) {
      throw new BadRequestException('You can upload a maximum of 20 files');
    }

    return this.s3Service.uploadFiles(files);
  }
}
