import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class WithdrawDTO {
  @IsNotEmpty()
  @IsNumber()
  amount: string;

  @IsOptional()
  @IsString()
  toAccountAddress: string;
}
