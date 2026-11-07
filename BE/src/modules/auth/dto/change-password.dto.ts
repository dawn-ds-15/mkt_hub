import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangePasswordDto {
  @Transform(({ obj, value }) => value ?? obj.old_password)
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu cũ không được để trống' })
  oldPassword: string;

  @Transform(({ obj, value }) => value ?? obj.new_password)
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu mới phải dài ít nhất 6 ký tự' })
  newPassword: string;
}
