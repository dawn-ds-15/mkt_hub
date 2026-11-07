import { Module } from '@nestjs/common';
import { LeadsKpisController } from './leads-kpis.controller';
import { LeadsKpisService } from './leads-kpis.service';
import { CompareController } from './compare.controller';
import { AiController } from './ai.controller';

@Module({
  controllers: [LeadsKpisController, CompareController, AiController],
  providers: [LeadsKpisService],
  exports: [LeadsKpisService],
})
export class LeadsKpisModule {}
