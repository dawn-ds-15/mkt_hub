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
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

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
}
