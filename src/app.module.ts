import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Web3Service } from './app/web3/web3.service';
import { AuthModule } from './app/modules/auth/auth.module';
import { WalletModule } from './app/modules/wallet/wallet.module';
import { DatabaseService } from './app/database/database.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configService } from './app/config/config.service';
import { ScheduleModule } from '@nestjs/schedule';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ThirdPartyApisService } from './app/third-party-apis/third-party-apis.service';

@Module({
  imports: [
    AuthModule,
    WalletModule,
    TypeOrmModule.forRoot(configService.getTypeOrmConfig()),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '../..', 'public'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, Web3Service, DatabaseService, ThirdPartyApisService],
})
export class AppModule {}
