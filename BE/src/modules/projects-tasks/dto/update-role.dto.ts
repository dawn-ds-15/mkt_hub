import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MemberRole {
  MANAGER = 'manager',
  SPECIALIST = 'specialist',
}

export class UpdateRoleDto {
  @ApiProperty({ enum: MemberRole, example: 'manager', description: 'Quyền mới cho thành viên' })
  @IsEnum(MemberRole, { message: 'Quyền không hợp lệ (phải là manager hoặc specialist)' })
  @IsNotEmpty({ message: 'Quyền không được để trống' })
  role: string;
}
