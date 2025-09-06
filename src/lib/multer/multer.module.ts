import { Global, Module } from '@nestjs/common';
import { MulterService } from './multer.service';

@Global()
@Module({
  providers: [MulterService],
})
export class MulterModule {}
