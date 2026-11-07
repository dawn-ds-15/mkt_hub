import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, VerifyOtpDto } from './dto/reset-password.dto';
import { AuditService } from '../audit/audit.service';
import { MailService } from './mail.service';

interface OtpData {
  otp: string;
  expiresAt: number;
  attempts: number;
  requestedAt: number;
}

@Injectable()
export class AuthService {
  private otpStore = new Map<string, OtpData>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
    private mailService: MailService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.member.findUnique({
      where: { email },
    });
    if (
      user &&
      user.isActive &&
      (await bcrypt.compare(pass, user.passwordHash))
    ) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const payload = { member_id: user.memberId, role: user.role };
    const result = {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };

    await this.auditService.log({
      userId: user.id,
      action: 'create',
      entityType: 'session',
      entityId: user.id,
      newValue: { email: user.email, action: 'login' },
    });

    return result;
  }

  /** Profile of the signed-in user (GET /auth/me). */
  async getProfile(userId: string) {
    const user = await this.prisma.member.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Người dùng không tồn tại hoặc đã bị vô hiệu hóa');
    }
    const { isActive: _isActive, ...profile } = user;
    return profile;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.member.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu cũ không chính xác');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.member.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.auditService.log({
      userId,
      action: 'update',
      entityType: 'member',
      entityId: userId,
      fieldChanged: 'password',
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.member.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.member.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hashedPassword,
        role: 'specialist',
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async logout(userId: string) {
    await this.auditService.log({
      userId,
      action: 'delete',
      entityType: 'session',
      entityId: userId,
      oldValue: { action: 'logout' },
    });
    return { message: 'Đăng xuất thành công' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('Email không tồn tại trong hệ thống hoặc tài khoản đã bị khóa');
    }

    const existingOtp = this.otpStore.get(email);
    if (existingOtp && Date.now() - existingOtp.requestedAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (Date.now() - existingOtp.requestedAt)) / 1000);
      throw new BadRequestException(`Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu mã OTP mới`);
    }

    // Sinh mã OTP 6 chữ số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 phút

    this.otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0,
      requestedAt: Date.now(),
    });

    await this.mailService.sendOtpEmail(user.email, otp, user.name);

    return {
      success: true,
      message: 'Mã xác thực (OTP) đã được gửi đến email của bạn. Mã có hiệu lực trong 10 phút.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const entry = this.otpStore.get(email);

    if (!entry || Date.now() > entry.expiresAt) {
      throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.');
    }

    if (entry.attempts >= 5) {
      this.otpStore.delete(email);
      throw new BadRequestException('Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.');
    }

    if (entry.otp !== dto.otp.trim()) {
      entry.attempts++;
      throw new BadRequestException('Mã OTP không chính xác');
    }

    return {
      success: true,
      message: 'Mã OTP hợp lệ',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const entry = this.otpStore.get(email);

    if (!entry || Date.now() > entry.expiresAt) {
      throw new BadRequestException('Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới.');
    }

    if (entry.attempts >= 5) {
      this.otpStore.delete(email);
      throw new BadRequestException('Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu mã mới.');
    }

    if (entry.otp !== dto.otp.trim()) {
      entry.attempts++;
      throw new BadRequestException('Mã OTP không chính xác');
    }

    const user = await this.prisma.member.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản người dùng');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.member.update({
      where: { email },
      data: { passwordHash: newPasswordHash },
    });

    // Xóa OTP sau khi đổi mật khẩu thành công
    this.otpStore.delete(email);

    await this.auditService.log({
      userId: user.id,
      action: 'update',
      entityType: 'member',
      entityId: user.id,
      fieldChanged: 'reset_password',
    });

    return {
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
    };
  }
}
