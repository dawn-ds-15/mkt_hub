import {
  Body,
  Controller,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LeadsKpisService } from './leads-kpis.service';
import { DeleteCompareDataDto } from './dto/leads-kpis.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Compare')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/compare')
export class CompareController {
  constructor(private readonly leadsKpisService: LeadsKpisService) {}

  @Roles(Role.manager)
  @Delete('data')
  async deleteCompareData(@Body() dto: DeleteCompareDataDto) {
    return this.leadsKpisService.deleteCompareData(dto.years);
  }
}
