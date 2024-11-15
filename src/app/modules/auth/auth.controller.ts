import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ResponseSuccess } from 'src/app/common/dto/response.dto';
import { IResponse } from 'src/app/common/interfaces/response.interface';
import { AuthKeyGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RegisterDTO } from './dto/Register.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Get('/me')
  async getProfile(@Request() req): Promise<IResponse> {
    const response = await this.authService.me(req?.user?.accountAddress);
    return new ResponseSuccess('Get Me', response);
  }

  @UseGuards(AuthKeyGuard)
  @Post('/login')
  async login(@Body() body): Promise<IResponse> {
    const response = await this.authService.login(body);
    return new ResponseSuccess('Login', response);
  }

  @UseGuards(AuthKeyGuard)
  @Post('/register')
  async register(@Body() body: RegisterDTO): Promise<IResponse> {
    const response = await this.authService.register(body);
    return new ResponseSuccess('Register', response);
  }

  @UseGuards(AuthKeyGuard)
  @Get('/test')
  async test(): Promise<IResponse> {
    const response = await this.authService.test();
    return new ResponseSuccess('Test', response);
  }

  @UseGuards(AuthKeyGuard)
  @Post('/admin-login')
  async adminLogin(@Body() body): Promise<IResponse> {
    const response = await this.authService.validateUser(
      body?.username,
      body?.password,
    );
    return new ResponseSuccess('Admin login', response);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/connect-wallet')
  async connectWallet(@Body() body, @Request() req): Promise<IResponse> {
    const response = await this.authService.validateSignature(req.user, body);
    return new ResponseSuccess('Connect wallet', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/request-nonce')
  async requestNonce(@Request() req): Promise<IResponse> {
    const response = await this.authService.requestNonce(req.user);
    return new ResponseSuccess('Request nonce', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/detach-wallet')
  async detachWalletAddress(@Request() req): Promise<IResponse> {
    const response = await this.authService.detachWalletAddress(req.user);
    return new ResponseSuccess('Detach wallet', response);
  }

  @UseGuards(AuthKeyGuard)
  @UseGuards(AuthGuard('jwt'))
  @Post('/check-email-account')
  async checkEmailAccount(@Body() body, @Request() req): Promise<IResponse> {
    const response = await this.authService.checkEmailAccount(req.user, body);
    return new ResponseSuccess('Check email account', response);
  }
}
