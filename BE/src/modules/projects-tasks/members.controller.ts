import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các thành viên (Specialist & Manager đều gọi được)' })
  async findAll() {
    const members = await this.prisma.member.findMany({
      select: {
        id: true,
        memberId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
    return members;
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Cấp quyền quản lý hoặc hạ quyền (Chỉ Manager mới được phép gọi)' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return updated;
  }
}
