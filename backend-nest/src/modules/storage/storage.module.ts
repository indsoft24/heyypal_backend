import { Module } from '@nestjs/common';
import { VpsStorageService } from './vps-storage.service';
import { BunnyStorageService } from './bunny-storage.service';
import { StorageProvider } from './storage-provider.interface';

const useBunny = process.env.STORAGE_PROVIDER === 'bunny';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Module({
  providers: [
    VpsStorageService,
    BunnyStorageService,
    {
      provide: STORAGE_PROVIDER,
      useClass: useBunny ? BunnyStorageService : VpsStorageService,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
