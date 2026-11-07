import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OverviewQueryDto {
  @ApiProperty({
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Kiểu chu kỳ lọc: week, month, quarter hoặc year (Hỗ trợ cả camelCase: periodType)',
    example: 'month',
  })
  @IsOptional()
  @IsEnum(['week', 'month', 'quarter', 'year'], {
    message: 'period_type phải là week, month, quarter hoặc year',
  })
  period_type?: 'week' | 'month' | 'quarter' | 'year';

  @IsOptional()
  @IsEnum(['week', 'month', 'quarter', 'year'], {
    message: 'periodType phải là week, month, quarter hoặc year',
  })
  periodType?: 'week' | 'month' | 'quarter' | 'year';

  @ApiPropertyOptional({
    description: 'Giá trị của chu kỳ tương ứng (ví dụ: tháng 1-12, tuần 1-53, quý 1-4) (Hỗ trợ cả camelCase: periodValue)',
    example: '1',
  })
  @IsOptional()
  @IsString()
  period_value?: string;

  @IsOptional()
  @IsString()
  periodValue?: string;

  @ApiProperty({
    description: 'Năm lọc dữ liệu',
    example: '2026',
  })
  @IsNotEmpty({ message: 'year không được để trống' })
  @IsString()
  year: string;

  @ApiPropertyOptional({
    description: 'Lọc theo ID dự án (Hỗ trợ cả camelCase: projectId)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsString()
  project_id?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  getNormalized() {
    const type = this.periodType || this.period_type || 'year';
    let value = this.periodValue || this.period_value;
    const projectId = this.projectId || this.project_id;

    if (!value && type !== 'year') {
      const today = new Date();
      if (type === 'month') {
        value = (today.getMonth() + 1).toString();
      } else if (type === 'quarter') {
        value = Math.ceil((today.getMonth() + 1) / 3).toString();
      } else if (type === 'week') {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const pastDaysOfYear = (today.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        value = Math.min(53, Math.max(1, weekNum)).toString();
      }
    }

    return {
      periodType: type as 'week' | 'month' | 'quarter' | 'year',
      periodValue: value,
      year: this.year,
      projectId,
    };
  }
}
