import { Injectable } from '@nestjs/common';
import { UserResponseDto } from '@project/common/dto/user-response.dto';
import { AppError } from '@project/common/error/handle-error.app';
import { HandleError } from '@project/common/error/handle-error.decorator';
import {
  successResponse,
  TResponse,
} from '@project/common/utils/response.util';
import { PrismaService } from '@project/lib/prisma/prisma.service';
import { UtilsService } from '@project/lib/utils/utils.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly utils: UtilsService,
  ) {}

  @HandleError('Registration failed', 'User')
  async register(dto: RegisterDto): Promise<TResponse<any>> {
    const { email, password, username } = dto;

    // * check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(400, 'User already exists with this email');
    }

    // * check if username already exists
    const existingUsernameUser = await this.prisma.user.findUnique({
      where: { username },
    });

    if (existingUsernameUser) {
      throw new AppError(400, 'Username already taken');
    }

    // * create new user
    const newUser = await this.prisma.user.create({
      data: {
        email,
        username,
        password: await this.utils.hash(password),
      },
    });

    return successResponse(
      this.utils.sanitizedResponse(UserResponseDto, newUser),
      'User registered successfully',
    );
  }

  @HandleError('Login failed', 'User')
  async login(dto: LoginDto): Promise<TResponse<any>> {
    const { email, password } = dto;

    // * find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError(400, 'User not found');
    }

    if (!user.password) {
      throw new AppError(
        400,
        'User password not set. Try Google or Facebook login.',
      );
    }

    // * check password
    const isPasswordValid = await this.utils.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError(400, 'Invalid credentials');
    }

    const token = this.utils.generateToken({
      sub: user.id,
      email: user.email,
      roles: user.role,
    });

    return successResponse(
      {
        user: this.utils.sanitizedResponse(UserResponseDto, user),
        token,
      },
      'User logged in successfully',
    );
  }
}
