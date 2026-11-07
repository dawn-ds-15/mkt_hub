import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';

class MockPrismaService {
  member = {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'specialist' }
    ]),
  };
  $connect = jest.fn();
  onModuleInit = jest.fn();
}

describe('MembersController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(MockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/members should return 404', async () => {
    await request(app.getHttpServer())
      .get('/api/members')
      .expect(404);
  });

  it('GET /api/auth/members without token should return 401', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/members')
      .expect(401);
  });
});
