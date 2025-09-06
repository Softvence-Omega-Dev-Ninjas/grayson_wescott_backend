import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError } from './handle-error.app';

export function simplifyError(
  error: Error,
  customMessage = 'Operation Failed',
  record = 'Record',
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new ConflictException(`${record} already exists`);
      case 'P2025':
        throw new NotFoundException(`${record} not found`);
      default:
        throw new InternalServerErrorException(
          `Database error: ${error.message}`,
        );
    }
  }

  if (error instanceof AppError) {
    switch (error.code) {
      case 400:
        throw new BadRequestException(error.message);
      case 401:
        throw new UnauthorizedException(error.message);
      case 403:
        throw new UnauthorizedException(error.message);
      case 404:
        throw new NotFoundException(error.message);
      case 409:
        throw new ConflictException(error.message);
      default:
        throw new InternalServerErrorException(error.message);
    }
  }

  throw new InternalServerErrorException(error.message || customMessage);
}
