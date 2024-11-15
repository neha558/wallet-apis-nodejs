import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health-check')
  healthCheck(): string {
    return 'Ok';
  }

  // @Get('import-data')
  // async importData() {
  //   return this.appService.importData();

  // }

  @Post('moralis-webhook')
  moralisWebhook(@Body() body) {
    return this.appService.moralisWebhook(body);
  }

  // @Get('old-data')
  // oldData() {
  //   return this.appService.oldData();
  // }
}
