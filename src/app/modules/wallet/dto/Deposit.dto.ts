import { IsNotEmpty, IsNumber } from 'class-validator';

export class DepositDTO {
  @IsNotEmpty()
  @IsNumber()
  amount: string;
}
