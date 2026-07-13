import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('supports the Projects & Tasks core flow', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@mkthub.com', password: 'admin123' })
      .expect(200);
    const token = login.body.access_token as string;
    const ownerId = login.body.user.id as string;

    const projectResponse = await request(app.getHttpServer())
      .post('/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Lead Generation',
        type: 'Lead Generation',
        status: 'Active',
        ownerId,
      })
      .expect(201);
    const projectId = projectResponse.body.id as string;

    try {
      await request(app.getHttpServer())
        .post('/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Blocked task',
          projectId,
          assigneeId: ownerId,
          status: 'Backlog',
          priority: 'High',
          dueDate: '2026-07-14',
          execWeek: 29,
          execYear: 2026,
        })
        .expect(400);

      const taskResponse = await request(app.getHttpServer())
        .post('/v1/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'E2E task',
          projectId,
          assigneeId: ownerId,
          status: 'Done',
          priority: 'Medium',
          dueDate: '2026-07-14',
          execWeek: 29,
          execYear: 2026,
        })
        .expect(201);
      expect(taskResponse.body.completedDate).toBeTruthy();

      const report = await request(app.getHttpServer())
        .get('/v1/weekly-reports?week=29&year=2026')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(report.body.sections.done).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: taskResponse.body.id }),
        ]),
      );
    } finally {
      await request(app.getHttpServer())
        .delete(`/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
