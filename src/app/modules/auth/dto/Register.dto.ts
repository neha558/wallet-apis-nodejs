import { IsNotEmpty } from 'class-validator';

export class RegisterDTO {
  @IsNotEmpty()
  _id: string;
}
