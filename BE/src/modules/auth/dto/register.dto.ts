import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'newuser@company.com', description: 'Email của thành viên mới' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn Mới', description: 'Tên hiển thị' })
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @ApiProperty({ example: 'password123', description: 'Mật khẩu (ít nhất 6 ký tự)' })
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
