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

  getNormalized() {
    const type = this.periodType || this.period_type || 'month';
    const value = this.periodValue || this.period_value;
    return {
      periodType: type as 'week' | 'month' | 'quarter' | 'year',
      periodValue: value,
      year: this.year,
    };
  }
}
