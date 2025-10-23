import { Injectable, Logger } from '@nestjs/common';
import { FileInstance } from '@prisma/client';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { ContactMailService } from '@project/lib/mail/services/contact-mail.service';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { S3Service } from '@project/main/s3/s3.service';

@Injectable()
export class CreateContactService {
  private readonly logger = new Logger(CreateContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly contactMailService: ContactMailService,
  ) {}

  @HandleError('Failed to send message', 'ContactForm')
  async createContact(
    dto: any,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    // * if image is provided, upload to S3 and get the URL
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadResult = await this.s3.uploadFiles([file]);
      if (!uploadResult.success) {
        throw new AppError(500, 'Failed to upload image');
      }

      fileInstance = uploadResult.data.files[0];
    }

    this.logger.log('Uploaded file: ', fileInstance);

    const contact = await this.prisma.contactForm.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        message: dto.message,
        street: dto?.street.trim(),
        city: dto?.city.trim(),
        postcode: dto?.postcode.trim(),
        ...(fileInstance && { file: { connect: { id: fileInstance.id } } }),
      },
      include: { file: true },
    });

    await this.contactMailService.notifySuperAdmin(contact, fileInstance);

    return successResponse(contact, 'Contact created successfully');
  }
}
