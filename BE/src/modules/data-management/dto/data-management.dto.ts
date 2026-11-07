import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class SaveSlackConfigDto {
  @IsString()
  @IsNotEmpty()
  webhookUrl: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsBoolean()
  notificationsEnabled: boolean;

  @IsString()
  @IsNotEmpty()
  sendTime: string; // "HH:MM" format

  @IsString()
  @IsNotEmpty()
  sendDays: string; // comma-separated days, e.g. "T2,T3,T4,T5,T6"

  @IsInt()
  @Min(1)
  @Max(30)
  alertDaysBefore: number;
}

export class CreateMemberDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(['manager', 'specialist'])
  @IsNotEmpty()
  role: 'manager' | 'specialist';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsNotEmpty()
  password?: string;
}

export class UpdateMemberDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(['manager', 'specialist'])
  @IsOptional()
  role?: 'manager' | 'specialist';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  password?: string;
}

export class UpdateDropdownDto {
  @IsNotEmpty()
  values: string[];
}

export class ResetSandboxDto {
  @IsString()
  @IsNotEmpty()
  confirmText: string; // must equal "RESET"
}

export class BulkImportConfirmDto {
  @IsEnum(['task', 'kpi', 'deal'])
  @IsNotEmpty()
  importType: 'task' | 'kpi' | 'deal';

  @IsOptional()
  projectId?: string; // target project for tasks import

  @IsOptional()
  @IsInt()
  year?: number; // target year for KPI/Deal imports

  @IsNotEmpty()
  rows: any[];
}

export class CreateDropdownOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateDropdownOptionDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

