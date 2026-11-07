import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadProjectDocumentsDto {
  @ApiPropertyOptional({
    description: 'Loại tài liệu: hoso (Hồ sơ) hoặc hopdong (Hợp đồng)',
    enum: ['hoso', 'hopdong'],
    default: 'hoso',
  })
  @IsOptional()
  @IsIn(['hoso', 'hopdong'], {
    message: 'category phải là "hoso" hoặc "hopdong"',
  })
  category?: 'hoso' | 'hopdong';
}

export class UpdateProjectDocumentDto {
  @ApiProperty({
    description: 'Loại tài liệu: hoso (Hồ sơ) hoặc hopdong (Hợp đồng)',
    enum: ['hoso', 'hopdong'],
    example: 'hopdong',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['hoso', 'hopdong'], {
    message: 'category phải là "hoso" hoặc "hopdong"',
  })
  category: 'hoso' | 'hopdong';
}

export class ProjectDocumentDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({ example: '10000000-0000-4000-8000-000000000001' })
  projectId: string;

  @ApiProperty({ example: 'hop_dong_dich_vu.pdf' })
  name: string;

  @ApiProperty({ example: 1048576 })
  size: number;

  @ApiPropertyOptional({ example: 'application/pdf', nullable: true })
  mimeType?: string | null;

  @ApiProperty({ enum: ['hoso', 'hopdong'], example: 'hoso' })
  category: string;

  @ApiProperty({
    example:
      'http://localhost:3000/api/v1/projects/documents/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/file',
    description:
      'Đường dẫn tuyệt đối để xem hoặc tải tài liệu trực tiếp trên trình duyệt',
  })
  url: string;

  @ApiProperty({ example: 'uploads/documents/1724217600000-hop_dong_dich_vu.pdf' })
  filePath: string;

  @ApiPropertyOptional({
    example: '00000000-0000-4000-8000-000000000001',
    nullable: true,
  })
  uploadedBy?: string | null;

  @ApiProperty({ example: '2026-08-21T10:00:00.000Z' })
  uploadedAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  archivedAt?: Date | null;
}

export class ProjectDocumentsListResponseDto {
  @ApiProperty({ type: [ProjectDocumentDto] })
  data: ProjectDocumentDto[];
}

export class ProjectDocumentSingleResponseDto {
  @ApiProperty({ type: ProjectDocumentDto })
  data: ProjectDocumentDto;
}
