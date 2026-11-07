import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env.SUPABASE_URL = saved.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = saved.SUPABASE_SERVICE_ROLE_KEY;
      if (saved.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
      if (saved.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('reports local storage when Supabase is not configured', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(appController.getHealth()).toEqual({ status: 'ok', storage: 'local' });
    });

    it('reports supabase storage when both variables are set', () => {
      process.env.SUPABASE_URL = 'https://x.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
      expect(appController.getHealth()).toEqual({ status: 'ok', storage: 'supabase' });
    });
  });
});
