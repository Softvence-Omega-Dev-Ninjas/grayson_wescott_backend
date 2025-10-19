import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { AppError } from '@project/common/error/handle-error.app';
import axios from 'axios';

@Injectable()
export class HyperhumanService {
  private readonly logger = new Logger(HyperhumanService.name);
  private readonly baseUrl = 'https://content.api.hyperhuman.cc/v1';
  private x_api_key: string;
  private org_id: string;

  constructor(private readonly configService: ConfigService) {
    this.x_api_key = this.configService.getOrThrow<string>(
      ENVEnum.HYPERHUMAN_X_API_KEY,
    );
    this.org_id = this.configService.getOrThrow<string>(
      ENVEnum.HYPERHUMAN_ORGANIZATION_ID,
    );
  }

  async getURLsByWorkOutId(workoutId: string) {
    const url = `${this.baseUrl}/workouts/${workoutId}`;

    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': this.x_api_key,
      },
    });

    this.logger.debug(`Response: from hyperhuman:`, response);

    if (response.status !== 200) {
      this.logger.error(`Failed to get URLs for workout ${workoutId}`);

      // 422 invalid workout id
      if (response.status === 422) {
        throw new AppError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'The workout id is invalid',
        );
      }

      // 404 not found
      if (response.status === 404) {
        throw new AppError(HttpStatus.NOT_FOUND, 'Workout not found');
      }

      throw new AppError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to get URLs for workout',
      );
    }

    const data = response.data;
    if (!data) {
      throw new AppError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to get URLs for workout',
      );
    }

    this.logger.log(`Getting URLs for workout ${workoutId}`);

    return {
      id: data.id,
      preview: data.preview,
    };
  }
}
