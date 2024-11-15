import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { configService } from 'src/app/config/config.service';
import { DatabaseService } from 'src/app/database/database.service';
import { ThirdPartyApisService } from 'src/app/third-party-apis/third-party-apis.service';
import { Web3Service } from 'src/app/web3/web3.service';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: configService.getJWTSecret(),
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    Web3Service,
    DatabaseService,
    ThirdPartyApisService,
  ],
})
export class AuthModule {}
