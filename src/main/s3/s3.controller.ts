import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationDto } from '@project/common/dto/pagination.dto';
import { ValidateAuth } from '@project/common/jwt/jwt.decorator';
import * as multer from 'multer';
import { DeleteFilesRequestDto } from './dto/delete-file.dto';
import { UploadFilesRequestDto } from './dto/upload-file-request.dto';
import { UploadFilesResponseDto } from './dto/upload-file-response.dto';
import { S3Service } from './s3.service';

@ApiBearerAuth()
@ValidateAuth()
@ApiTags('Files (S3) & DB')
@Controller('files')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  @ApiOperation({ summary: 'Upload multiple OR single files to S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadFilesRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: UploadFilesResponseDto,
  })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: multer.memoryStorage(),
      limits: { files: 5 },
    }),
  )
  async upload(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No file(s) uploaded');
    }

    if (files.length > 5) {
      throw new BadRequestException('You can upload a maximum of 5 files');
    }

    return this.s3Service.uploadFiles(files);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete multiple files from S3' })
  async deleteFiles(@Body() body: DeleteFilesRequestDto) {
    return this.s3Service.deleteFiles(body.fileIds);
  }

  @Get()
  @ApiOperation({ summary: 'Get all files from S3' })
  async getFiles(@Query() pg: PaginationDto) {
    return this.s3Service.getFiles(pg);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific file from S3' })
  async getFileById(@Param('id') id: string) {
    return this.s3Service.getFileById(id);
  }
}
