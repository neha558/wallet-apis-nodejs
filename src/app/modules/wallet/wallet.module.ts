import { Module } from '@nestjs/common';
import { DatabaseService } from 'src/app/database/database.service';
import { ThirdPartyApisService } from 'src/app/third-party-apis/third-party-apis.service';
import { Web3Service } from 'src/app/web3/web3.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  controllers: [WalletController],
  providers: [
    WalletService,
    DatabaseService,
    Web3Service,
    ThirdPartyApisService,
  ],
})
export class WalletModule {}
