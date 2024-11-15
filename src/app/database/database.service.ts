import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { configService } from '../config/config.service';

export const AppDataSource = new DataSource(configService.getTypeOrmConfig());

@Injectable()
export class DatabaseService {
  async getDataSource() {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    return AppDataSource;
  }
}
