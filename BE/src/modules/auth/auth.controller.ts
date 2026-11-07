import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, VerifyOtpDto } from './dto/reset-password.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from '../permissions/permissions.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private permissionsService: PermissionsService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới (Mặc định là Specialist)' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    // Module & profile permissions of the user (BE_requirement_29_09_26 §2 & BE_requirement_24_10_26 §5)
    const permissions = await this.permissionsService.getAuthPermissions(
      result.user.id,
      result.user.role,
    );
    return { ...result, permissions, user: { ...result.user, permissions } };
  }

  @ApiBearerAuth()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Thông tin tài khoản đang đăng nhập kèm quyền theo module' })
  async me(@CurrentUser() user: any) {
    const profile = await this.authService.getProfile(user.id);
    const permissions = await this.permissionsService.getAuthPermissions(
      profile.id,
      profile.role,
    );
    return { ...profile, permissions, data: { ...profile, permissions } };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu gửi mã OTP đặt lại mật khẩu qua email' })
  @ApiResponse({ status: 200, description: 'Đã gửi mã OTP qua email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực mã OTP trước khi đặt lại mật khẩu' })
  @ApiResponse({ status: 200, description: 'Mã OTP hợp lệ' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu mới bằng mã OTP' })
  @ApiResponse({ status: 200, description: 'Đặt lại mật khẩu thành công' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu khi đã đăng nhập' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất tài khoản' })
  async logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }
}
