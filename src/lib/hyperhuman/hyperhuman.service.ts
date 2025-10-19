import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import { HandleError } from '@project/common/error/handle-error.decorator';
import { GetWorkoutsFromHyperhumanDto } from '@project/main/admin/library/dto/get-workouts-from-hyperhuman.dto';
import axios from 'axios';
import queryString from 'query-string';

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

  @HandleError('Failed to get workouts from Hyperhuman', 'Library Exercise')
  async getWorkoutsFromHyperhuman(query: GetWorkoutsFromHyperhumanDto) {
    const url = `${this.baseUrl}/orgs/${this.org_id}/workouts?${queryString.stringify(query)}`;

    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': this.x_api_key,
      },
    });

    this.logger.log(`Workouts from Hyperhuman`, response.data);

    return response.data;
  }

  async getURLsByWorkOutId(workoutId: string) {
    const url = `${this.baseUrl}/workouts/${workoutId}`;

    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': this.x_api_key,
      },
    });

    const data = response.data.data;
    const previewUrl = data.preview.url;
    const thumbnailUrl = data.preview.thumbnail;

    const endpoint = `${this.baseUrl}/workouts/${workoutId}/export/video/stream_url`;
    const fullVideoUrlResponse = await axios.get(endpoint, {
      headers: {
        'X-Api-Key': this.x_api_key,
      },
    });

    const videoUrl = fullVideoUrlResponse.data;

    return {
      videoData: {
        workoutId: data.id,
        previewUrl,
        previewUrlExpiresAt: this.extractExpiry(previewUrl),
        thumbnailUrl,
        thumbnailUrlExpiresAt: this.extractExpiry(thumbnailUrl),
        videoUrl,
        videoUrlExpiresAt: this.extractExpiry(videoUrl),
      },
      hyperhumanData: data,
    };
  }

  private extractExpiry(url: string): Date | null {
    const query = url.split('?')[1];
    if (!query) return null;

    const params = queryString.parse(query);
    const expiresInSec = params['X-Amz-Expires']
      ? Number(params['X-Amz-Expires'])
      : null;
    const amzDate = params['X-Amz-Date'] ? String(params['X-Amz-Date']) : null;

    if (!expiresInSec || !amzDate) return null;

    // Convert X-Amz-Date (e.g. 20251019T224719Z) to Date
    const startDate = new Date(
      `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(
        6,
        8,
      )}T${amzDate.slice(9, 11)}:${amzDate.slice(
        11,
        13,
      )}:${amzDate.slice(13, 15)}Z`,
    );

    return new Date(startDate.getTime() + expiresInSec * 1000);
  }
}
