import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email của tài khoản' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '482910', description: 'Mã OTP gồm 6 chữ số' })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @Length(6, 6, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  otp: string;

  @ApiProperty({ example: 'NewPassword@123', description: 'Mật khẩu mới (tối thiểu 6 ký tự)' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email của tài khoản' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '482910', description: 'Mã OTP gồm 6 chữ số' })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @Length(6, 6, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  otp: string;
}
