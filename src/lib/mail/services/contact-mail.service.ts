import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContactForm, FileInstance } from '@prisma/client';
import { ENVEnum } from '@project/common/enum/env.enum';
import { MailService } from '../mail.service';
import { contactFormTemplate } from '../templates/contact-form.template';

@Injectable()
export class ContactMailService {
  private readonly logger = new Logger(ContactMailService.name);
  private readonly superAdminEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.superAdminEmail = this.configService.getOrThrow(
      ENVEnum.SUPER_ADMIN_EMAIL,
    );
  }

  async sendContactFormEmail(
    to: string,
    contact: ContactForm,
    file?: FileInstance, // optional uploaded file
  ) {
    this.logger.log('Notifying super admin...');
    const subject = `New Contact Form Submission from "${contact.name}"`;
    const html = contactFormTemplate(contact);

    const text = `New contact form submission:

Name: ${contact.name}
Email: ${contact.email}
Phone: ${contact.phone}
Message: ${contact.message}
Street: ${contact.street || '-'}
City: ${contact.city || '-'}
Postcode: ${contact.postcode || '-'}

Check the admin panel for more details.`;

    const mailOptions: any = {
      to,
      subject,
      html,
      text,
    };

    // Attach file if provided
    if (file) {
      mailOptions.attachments = [
        {
          filename: file.originalFilename || 'attachment',
          path: file.url,
        },
      ];
    }

    const info = await this.mailService.sendMail(mailOptions);

    this.logger.log('Email sent successfully');
    return info;
  }

  async notifySuperAdmin(contact: ContactForm, file?: FileInstance) {
    if (!this.superAdminEmail) {
      this.logger.log('Super admin email not found');
      return;
    }
    return this.sendContactFormEmail(this.superAdminEmail, contact, file);
  }
}
