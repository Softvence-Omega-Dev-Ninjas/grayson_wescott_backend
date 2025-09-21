import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileType } from '@prisma/client';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private AWS_S3_BUCKET_NAME: string;
  private AWS_REGION: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.AWS_REGION = this.configService.getOrThrow(ENVEnum.AWS_REGION);
    this.AWS_S3_BUCKET_NAME = this.configService.getOrThrow(
      ENVEnum.AWS_S3_BUCKET_NAME,
    );

    this.s3 = new S3Client({
      region: this.AWS_REGION,
      credentials: {
        accessKeyId: this.configService.getOrThrow(ENVEnum.AWS_ACCESS_KEY_ID),
        secretAccessKey: this.configService.getOrThrow(
          ENVEnum.AWS_SECRET_ACCESS_KEY,
        ),
      },
    });
  }

  @HandleError('Failed to upload file(s)', 'File')
  async uploadFiles(files: Express.Multer.File[]): Promise<TResponse<any>> {
    if (!files || files.length === 0) {
      throw new AppError(404, 'No file(s) uploaded');
    }

    if (files.length > 5) {
      throw new AppError(400, 'You can upload a maximum of 5 files');
    }

    const results = [];

    for (const file of files) {
      results.push(await this.uploadFile(file));
    }

    return successResponse(
      {
        files: results,
        count: results.length,
      },
      'Files uploaded successfully',
    );
  }

  private async uploadFile(file: Express.Multer.File) {
    const fileExt = file.originalname.split('.').pop();
    const folder = this.getFolderByMimeType(file.mimetype);
    const uniqueFileName = `${uuid()}.${fileExt}`;
    const s3Key = `${folder}/${uniqueFileName}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3.send(command);

    // Construct file URL
    const fileUrl = `https://${this.AWS_S3_BUCKET_NAME}.s3.${this.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Save record in database
    const fileRecord = await this.prisma.fileInstance.create({
      data: {
        filename: uniqueFileName,
        originalFilename: file.originalname,
        path: s3Key,
        url: fileUrl,
        fileType: this.getFileType(file.mimetype),
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return fileRecord;
  }

  private getFolderByMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'documents';
  }

  private getFileType(mimeType: string): FileType {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType === 'application/pdf') return 'DOCUMENT';
    return 'ANY';
  }
}
