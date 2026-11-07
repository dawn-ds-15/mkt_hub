import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    });
  }

  async validate(payload: any) {
    if (!payload || typeof payload.member_id !== 'number') {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const user = await this.prisma.member.findUnique({
      where: { memberId: payload.member_id },
      // Runs on every authenticated request: load only the fields used below
      select: { id: true, email: true, role: true, name: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Người dùng không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
