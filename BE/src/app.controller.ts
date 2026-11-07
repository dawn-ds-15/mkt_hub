import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { fileStorage } from './common/storage/file-storage';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /api/health — "storage: local" on Render means uploads are lost at the next deploy
  @Get('health')
  getHealth() {
    return { status: 'ok', storage: fileStorage.getMode() };
  }
}
