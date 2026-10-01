import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // Self-contained: a fresh clone has no backend/.env, and AuthModule refuses to boot without these.
    process.env.JWT_ACCESS_SECRET ??= 'e2e-secret';
    process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
    // Prisma connects on boot, so the health check needs a database too; reuse the e2e one.
    process.env.DATABASE_URL ??= process.env.E2E_DATABASE_URL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: 'growth-backend' });
  });

  afterEach(async () => {
    await app?.close();
  });
});
