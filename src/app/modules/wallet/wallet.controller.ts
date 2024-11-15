import { Controller, Get } from '@nestjs/common';
import {
  Body,
  Post,
  UseGuards,
  Request,
  Query,
  Param,
} from '@nestjs/common/decorators';
import { AuthGuard } from '@nestjs/passport';
import { ResponseSuccess } from 'src/app/common/dto/response.dto';
import { IResponse } from 'src/app/common/interfaces/response.interface';
import { AuthKeyGuard } from '../auth/auth.guard';
import { DepositDTO } from './dto/Deposit.dto';
import { WithdrawDTO } from './dto/Withdraw.dto';
import { WalletService } from './wallet.service';

@Controller('api/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/deposit')
  async deposit(@Body() body: DepositDTO, @Request() req): Promise<IResponse> {
    const response = await this.walletService.deposit(body, req?.user);
    return new ResponseSuccess('Deposit', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/withdraw_request')
  async withdrawRequest(@Body() body, @Request() req): Promise<IResponse> {
    const response = this.walletService.withdrawRequest(body, req?.user);
    return new ResponseSuccess('Withdraw request', response);
  }

  @Get('/withdraw_request')
  async getWithdrawRequest(@Query() query): Promise<IResponse> {
    const response = await this.walletService.getWithdrawRequest(query);
    return new ResponseSuccess('Get Withdraw request', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/mine')
  async mine(@Request() req): Promise<IResponse> {
    const response = await this.walletService.mine(req?.user);
    return new ResponseSuccess('My wallet', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/withdraw')
  async withdraw(
    @Body() body: WithdrawDTO,
    @Request() req,
  ): Promise<IResponse> {
    const response = await this.walletService.withdraw(body, req?.user);
    return new ResponseSuccess('Withdraw request', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/transactions')
  async transactions(@Request() req, @Query() query): Promise<IResponse> {
    const response = await this.walletService.transactions(req?.user, query);
    return new ResponseSuccess('My transactions', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/config')
  async updateConfig(@Request() req, @Body() body): Promise<IResponse> {
    const response = await this.walletService.updateConfig(body, req?.user);
    return new ResponseSuccess('Save config', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/config/:name')
  async getConfig(@Request() req, @Param() params): Promise<IResponse> {
    const response = await this.walletService.getConfig({ name: params?.name });
    return new ResponseSuccess('Get config', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/deduct')
  async deduct(@Body() body: DepositDTO, @Request() req): Promise<IResponse> {
    const response = await this.walletService.deduct(body, req?.user);
    return new ResponseSuccess('Deduct', response);
  }

  @Get('/update_tx')
  async updateTx(): Promise<IResponse> {
    const response = await this.walletService.updateTx();
    return new ResponseSuccess('Sync Withdraw request', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/multiple-txs')
  async multipleTx(@Body() body, @Request() req): Promise<IResponse> {
    const response = await this.walletService.multipleTx(body, req?.user);
    return new ResponseSuccess('Multiple Tx', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/de-link-wallet-via-admin')
  async deLinkWalletViaAdmin(@Body() body, @Request() req): Promise<IResponse> {
    const response = await this.walletService.deLinkWalletViaAdmin(
      body,
      req?.user,
    );
    return new ResponseSuccess('Delink wallet', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/nft-airdrop-daily-report/history')
  async getNFTAirdropDailyReportHistory(
    @Request() req,
    @Query() query,
  ): Promise<IResponse> {
    const response = await this.walletService.getNFTAirdropDailyReportHistory(
      req?.user,
      query,
    );
    return new ResponseSuccess('NFT Airdrop Daily Report History', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/nft-airdrop-daily-report')
  async getNFTAirdropDailyReport(@Request() req): Promise<IResponse> {
    const response = await this.walletService.getNFTAirdropDailyReport(
      req?.user,
    );
    return new ResponseSuccess('NFT Airdrop Daily Report', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/claim-nft-airdrop-daily-report')
  async claimNFTAirdrop(@Request() req): Promise<IResponse> {
    const response = await this.walletService.claimNFTAirdrop(req?.user);
    return new ResponseSuccess(
      'Congratulations! You have successfully claimed your airdrop. Please check your wallet now.',
      response,
    );
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/deduct-usdt')
  async deductUSDT(
    @Body() body: DepositDTO,
    @Request() req,
  ): Promise<IResponse> {
    const response = await this.walletService.deductUSDT(body, req?.user);
    return new ResponseSuccess('Deduct USDT', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/nft-airdrop-daily-report-based-on-account/history')
  async getNFTAirdropDailyReportBasedOnAccountHistory(
    @Request() req,
    @Query() query,
  ): Promise<IResponse> {
    const response =
      await this.walletService.getNFTAirdropDailyReportHistoryBasedOnAccount(
        req?.user,
        query,
      );
    return new ResponseSuccess('NFT Airdrop Daily Report History', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/nft-airdrop-daily-report-based-on-account')
  async getNFTAirdropDailyReportBasedOnAccount(
    @Request() req,
    @Body() body,
  ): Promise<IResponse> {
    const response =
      await this.walletService.getNFTAirdropDailyReportBasedOnAccount(
        req?.user,
        body,
      );
    return new ResponseSuccess('NFT Airdrop Daily Report', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/claim-nft-airdrop-daily-report-based-on-account')
  async claimNFTAirdropBasedOnAccount(
    @Request() req,
    @Body() body,
  ): Promise<IResponse> {
    const response = await this.walletService.claimNFTAirdropBasedOnAccount(
      req?.user,
      body,
    );
    return new ResponseSuccess(
      'Congratulations! You have successfully claimed your airdrop. Please check your wallet now.',
      response,
    );
  }
}
