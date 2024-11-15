import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { configService } from 'src/app/config/config.service';

@Injectable()
export class AuthKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    if (
      request.headers?.['x-wallet-api-key'] !== configService.getWalletAuthKey()
    ) {
      throw new UnauthorizedException('Provide wallet auth key');
    }

    return true;
  }
}
