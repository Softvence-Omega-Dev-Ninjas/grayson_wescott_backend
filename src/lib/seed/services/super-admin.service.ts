import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import chalk from 'chalk';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): Promise<void> {
    return this.seedSuperAdminUser();
  }

  async seedSuperAdminUser(): Promise<void> {
    const superAdminEmail = this.configService.getOrThrow<string>(
      ENVEnum.SUPER_ADMIN_EMAIL,
    );
    const superAdminPass = this.configService.getOrThrow<string>(
      ENVEnum.SUPER_ADMIN_PASS,
    );
    const superAdminPhone = this.configService.getOrThrow<string>(
      ENVEnum.SUPER_ADMIN_PHONE,
    );
    const superAdminEmployeeID = this.configService.getOrThrow<string>(
      ENVEnum.SUPER_ADMIN_EMPLOYEE_ID,
    );

    const superAdminExists = await this.prisma.user.findFirst({
      where: {
        email: superAdminEmail,
      },
    });

    // * create super admin
    if (!superAdminExists) {
      await this.prisma.user.create({
        data: {
          email: superAdminEmail,
          employeeID: Number(superAdminEmployeeID),
          phone: superAdminPhone,
          password: await this.utils.hash(superAdminPass),
          isLogin: true,
          isVerified: true,
          lastLoginAt: new Date(),
          role: 'SUPER_ADMIN',
        },
      });
      console.info(
        chalk.bgGreen.white.bold(
          `🚀 Super Admin user created with email: ${superAdminEmail}`,
        ),
      );
      return;
    }

    // * update login
    await this.prisma.user.update({
      where: {
        email: superAdminEmail,
      },
      data: {
        isLogin: true,
        lastLoginAt: new Date(),
        otpExpiresAt: this.utils.generateOtpAndExpiry().expiryTime,
      },
    });
    console.info(
      chalk.bgGreen.white.bold(
        `🚀 Super Admin user updated with email: ${superAdminEmail}`,
      ),
    );
  }
}
