import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, readdirSync, rmSync } from 'fs';
import { AwsClient } from 'aws4fetch';
import { join } from 'path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';

/**
 * The permission matrix in docs/user-flows.md §2, exercised over HTTP against a real Postgres.
 *
 * Needs an empty, migrated database: E2E_DATABASE_URL=postgresql://... npm run test:e2e
 * (every table is truncated first). Skipped when unset, so `npm test` stays database-free.
 */
const DB = process.env.E2E_DATABASE_URL;
const R2_ENDPOINT = process.env.E2E_R2_ENDPOINT;
const maybe = DB ? describe : describe.skip;

const PASSWORD = 'Test1234!';
const UPLOADS = join(process.cwd(), 'uploads', 'bone-age');
const HAND = join(__dirname, 'fixtures', 'hand.png');
const countUploads = () =>
  existsSync(UPLOADS) ? readdirSync(UPLOADS).length : 0;

maybe('roles and permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const token: Record<string, string> = {};
  const id: Record<string, string> = {};
  let childId: string;
  const DOB = '2016-03-15';

  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({
    get: (url: string) =>
      http().get(url).set('Authorization', `Bearer ${token[who]}`),
    post: (url: string) =>
      http().post(url).set('Authorization', `Bearer ${token[who]}`),
    patch: (url: string) =>
      http().patch(url).set('Authorization', `Bearer ${token[who]}`),
    delete: (url: string) =>
      http().delete(url).set('Authorization', `Bearer ${token[who]}`),
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    // With an S3-compatible endpoint (e.g. a local moto or MinIO server), uploads also go
    // through the R2 path in common/uploads.ts.
    if (R2_ENDPOINT) {
      process.env.R2_ENDPOINT = R2_ENDPOINT;
      process.env.R2_ACCOUNT_ID = 'e2e';
      process.env.R2_ACCESS_KEY_ID = 'test';
      process.env.R2_SECRET_ACCESS_KEY = 'test';
      process.env.R2_BUCKET = process.env.E2E_R2_BUCKET ?? 'growth-test';
    }
    process.env.JWT_ACCESS_SECRET ??= 'e2e-secret';
    process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
    delete process.env.RESEND_API_KEY;

    prisma = new PrismaClient({ datasources: { db: { url: DB } } });
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );

    const hash = await bcrypt.hash(PASSWORD, 4);
    const people = {
      parent: { role: 'USER' },
      caretaker: { role: 'USER' },
      stranger: { role: 'USER' },
      doctor: {
        role: 'DOCTOR',
        doctorStatus: 'PENDING',
        licenseNumber: 'L-1',
        hospital: 'H',
      },
      admin: { role: 'ADMIN' },
    } as const;
    for (const [name, extra] of Object.entries(people)) {
      const u = await prisma.user.create({
        data: {
          email: `${name}@e2e.test`,
          fullName: `${name} person`,
          passwordHash: hash,
          isVerified: true,
          ...extra,
        },
      });
      id[name] = u.id;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    for (const name of Object.keys(people)) {
      const res = await http()
        .post('/auth/login')
        .send({ email: `${name}@e2e.test`, password: PASSWORD })
        .expect(200);
      token[name] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  const invite = async (role: 'CARETAKER' | 'DOCTOR') => {
    const res = await as('parent')
      .post(`/children/${childId}/invites`)
      .send({ role })
      .expect(201);
    return res.body.link.split('/invite/')[1] as string;
  };

  it('parent creates a child and is its parent', async () => {
    const res = await as('parent')
      .post('/children')
      .send({
        fullName: 'Mali Test',
        sex: 'FEMALE',
        dateOfBirth: DOB,
        hn: 'HN-4411',
      })
      .expect(201);
    childId = res.body.id;
    expect(res.body).toMatchObject({
      myRole: 'PARENT',
      hn: 'HN-4411',
      familyName: 'parent person',
    });
  });

  it('a stranger cannot see the child', async () => {
    await as('stranger').get(`/children/${childId}`).expect(403);
    await as('stranger').get(`/growth?childId=${childId}`).expect(403);
  });

  it('an invitation previews the first name only, and works once', async () => {
    const t = await invite('CARETAKER');
    const preview = await http().get(`/invites/${t}`).expect(200);
    expect(preview.body).toMatchObject({
      childFirstName: 'Mali',
      role: 'CARETAKER',
      state: 'valid',
    });
    expect(JSON.stringify(preview.body)).not.toContain('Test');

    await as('caretaker').post(`/invites/${t}/accept`).expect(200);
    await as('stranger').post(`/invites/${t}/accept`).expect(410);
  });

  it('a doctor invitation needs an approved doctor', async () => {
    const t = await invite('DOCTOR');
    await as('stranger').post(`/invites/${t}/accept`).expect(403);
    await as('doctor').post(`/invites/${t}/accept`).expect(403); // still pending

    await as('parent').get('/admin/doctors').expect(403);
    await as('admin')
      .patch(`/admin/doctors/${id.doctor}`)
      .send({ decision: 'APPROVED' })
      .expect(200);
    await as('doctor').post(`/invites/${t}/accept`).expect(200);
  });

  it('a caretaker sees the child without its hospital number, and cannot edit it', async () => {
    const res = await as('caretaker').get(`/children/${childId}`).expect(200);
    expect(res.body.myRole).toBe('CARETAKER');
    expect(res.body).not.toHaveProperty('hn');
    await as('caretaker')
      .patch(`/children/${childId}`)
      .send({ fullName: 'Renamed' })
      .expect(403);
    await as('caretaker').get(`/children/${childId}/members`).expect(403);
  });

  it('a doctor may set the hospital number and nothing else', async () => {
    await as('doctor')
      .patch(`/children/${childId}`)
      .send({ hn: 'HN-9001' })
      .expect(200);
    await as('doctor')
      .patch(`/children/${childId}`)
      .send({ fullName: 'Renamed' })
      .expect(403);
  });

  it('a doctor finds only their own patients by HN', async () => {
    const mine = await as('doctor').get('/children?hn=9001').expect(200);
    expect(mine.body.map((c: { id: string }) => c.id)).toEqual([childId]);
    const theirs = await as('stranger').get('/children?hn=9001').expect(200);
    expect(theirs.body).toEqual([]);
  });

  it('everyone linked can record growth', async () => {
    for (const who of ['parent', 'caretaker', 'doctor']) {
      await as(who)
        .post('/growth')
        .send({ childId, heightCm: 130, weightKg: 28 })
        .expect(201);
    }
    const list = await as('caretaker')
      .get(`/growth?childId=${childId}`)
      .expect(200);
    expect(list.body).toHaveLength(3);
  });

  describe('puberty', () => {
    const answers = { breastDevelopment: 'yes', breastDevelopmentAgeYears: 6 };

    it('a caretaker submits but gets no result, and parent and doctor are told', async () => {
      const res = await as('caretaker')
        .post('/puberty/questionnaire')
        .send({ childId, answers })
        .expect(201);
      expect(res.body).toMatchObject({
        resultShared: false,
        submittedByMe: true,
      });
      expect(res.body).not.toHaveProperty('result');
      expect(res.body).not.toHaveProperty('answers');

      for (const who of ['parent', 'doctor']) {
        const n = await as(who).get('/notifications').expect(200);
        expect(
          n.body.some((x: { type: string }) => x.type === 'PUBERTY_SUBMITTED'),
        ).toBe(true);
      }
      const own = await as('caretaker').get('/notifications').expect(200);
      expect(
        own.body.some((x: { type: string }) => x.type === 'PUBERTY_SUBMITTED'),
      ).toBe(false);
    });

    it('a caretaker cannot read results, history or the plan', async () => {
      const history = await as('caretaker')
        .get(`/puberty/history?childId=${childId}`)
        .expect(200);
      expect(history.body[0]).not.toHaveProperty('result');
      expect(history.body[0]).not.toHaveProperty('answers');
      await as('caretaker').get(`/puberty/plan?childId=${childId}`).expect(403);
      await as('caretaker').get(`/puberty/${history.body[0].id}`).expect(403);
    });

    it('parent and doctor read the result', async () => {
      for (const who of ['parent', 'doctor']) {
        const history = await as(who)
          .get(`/puberty/history?childId=${childId}`)
          .expect(200);
        expect(history.body[0].result.outcome).toBe('EARLY_SIGNS');
      }
    });

    it('suggestions do not leak the result to a caretaker', async () => {
      const res = await as('caretaker')
        .get(`/suggestions?childId=${childId}`)
        .expect(200);
      const kinds = res.body.map((s: { kind: string }) => s.kind);
      expect(kinds).not.toContain('BONE_AGE_UPLOAD');
      expect(kinds).not.toContain('PUBERTY_FOLLOW_UP');
    });
  });

  describe('bone age', () => {
    let recordId: string;

    it('parent and caretaker cannot upload, and the refused file is not kept', async () => {
      const before = countUploads();
      for (const who of ['parent', 'caretaker']) {
        await as(who)
          .post('/bone-age/upload')
          .field('childId', childId)
          .attach('file', HAND)
          .expect(403);
      }
      expect(countUploads()).toBe(before);
    });

    it('the doctor uploads, and the age is taken on the exam date', async () => {
      const examDate = '2026-03-15';
      const res = await as('doctor')
        .post('/bone-age/upload')
        .field('childId', childId)
        .field('examDate', examDate)
        .attach('file', HAND)
        .expect(201);
      recordId = res.body.id;
      // Ten years to the day after 2016-03-15, measured the same way growth records are.
      expect(res.body.chronologicalAgeMonths).toBe(120);
    });

    it('a WebP X-ray is kept as uploaded and served back as WebP', async () => {
      const webp = await sharp(HAND).webp({ lossless: true }).toBuffer();
      const res = await as('doctor')
        .post('/bone-age/upload')
        .field('childId', childId)
        .attach('file', webp, {
          filename: 'hand.webp',
          contentType: 'image/webp',
        })
        .expect(201);
      const image = await as('doctor')
        .get(`/bone-age/${res.body.id}/image`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(image.headers['content-type']).toBe('image/webp');
      expect((image.body as Buffer).equals(webp)).toBe(true);

      if (R2_ENDPOINT) {
        // As after a redeploy: the local copy is gone, the R2 copy still serves the image.
        const row = await prisma.boneAgePrediction.findUniqueOrThrow({
          where: { id: res.body.id },
        });
        const name = row.imageUrl.split('/').pop()!;
        rmSync(join(UPLOADS, name));
        const again = await as('doctor')
          .get(`/bone-age/${res.body.id}/image`)
          .buffer(true)
          .parse((r, cb) => {
            const chunks: Buffer[] = [];
            r.on('data', (c: Buffer) => chunks.push(c));
            r.on('end', () => cb(null, Buffer.concat(chunks)));
          })
          .expect(200);
        expect((again.body as Buffer).equals(webp)).toBe(true);
        await as('doctor').delete(`/bone-age/${res.body.id}`).expect(200);
        const r2 = new AwsClient({
          accessKeyId: 'test',
          secretAccessKey: 'test',
          service: 's3',
          region: 'auto',
        });
        const gone = await r2.fetch(
          `${R2_ENDPOINT}/${process.env.R2_BUCKET}/bone-age/${name}`,
        );
        expect(gone.status).toBe(404);
        return;
      }
      await as('doctor').delete(`/bone-age/${res.body.id}`).expect(200);
    });

    it('a file that is not an image is refused and not kept', async () => {
      const before = countUploads();
      await as('doctor')
        .post('/bone-age/upload')
        .field('childId', childId)
        .attach('file', Buffer.from('<html>not an x-ray</html>'), {
          filename: 'x.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(countUploads()).toBe(before);
    });

    it('the family sees nothing until the doctor has reviewed it', async () => {
      const res = await as('parent')
        .get(`/bone-age/history?childId=${childId}`)
        .expect(200);
      expect(res.body).toEqual([]);
      await as('parent').get(`/bone-age/${recordId}`).expect(404);
    });

    it("after review, the family sees the doctor's reading and nothing else", async () => {
      await as('parent')
        .patch(`/bone-age/${recordId}`)
        .send({ review: 'NORMAL' })
        .expect(403);
      await as('doctor')
        .patch(`/bone-age/${recordId}`)
        .send({ review: 'ADVANCED', doctorNote: 'Recheck in 6 months' })
        .expect(200);

      for (const who of ['parent', 'caretaker']) {
        const res = await as(who)
          .get(`/bone-age/history?childId=${childId}`)
          .expect(200);
        expect(Object.keys(res.body[0]).sort()).toEqual(
          [
            'childId',
            'doctorNote',
            'examDate',
            'id',
            'review',
            'reviewedAt',
          ].sort(),
        );
        expect(res.body[0].review).toBe('ADVANCED');
        await as(who).get(`/bone-age/${recordId}/image`).expect(403);
        const n = await as(who).get('/notifications').expect(200);
        expect(
          n.body.some((x: { type: string }) => x.type === 'BONE_AGE_RESULT'),
        ).toBe(true);
      }
    });

    it('the doctor sees the full record, with the gap computed on the server', async () => {
      const res = await as('doctor').get(`/bone-age/${recordId}`).expect(200);
      expect(res.body).toHaveProperty('predictedAgeMonths');
      expect(res.body).toHaveProperty('gapMonths');
      expect(res.body).toHaveProperty('implausibleGap');
      await as('doctor').get(`/bone-age/${recordId}/image`).expect(200);
    });
  });

  describe('admin', () => {
    it('is admins only', async () => {
      for (const who of ['parent', 'caretaker', 'doctor', 'stranger']) {
        await as(who).get('/admin/stats').expect(403);
        await as(who).get('/admin/export.csv?dataset=growth').expect(403);
      }
      const stats = await as('admin').get('/admin/stats').expect(200);
      expect(stats.body.totals.children).toBe(1);
    });

    it('exports no names, hospital numbers or dates of birth', async () => {
      for (const dataset of ['growth', 'puberty', 'bone-age']) {
        const res = await as('admin')
          .get(`/admin/export.csv?dataset=${dataset}`)
          .expect(200);
        expect(res.text).not.toMatch(/Mali|HN-|2016-03-15|@e2e\.test|person/);
        expect(res.text.split('\r\n').length).toBeGreaterThan(2);
      }
    });

    it('receives contact messages linked to the signed-in sender, and problem reports', async () => {
      await as('parent')
        .post('/support/contact')
        .send({ email: 'parent@e2e.test', subject: 'Hi', message: 'Question' })
        .expect(201);
      await as('caretaker')
        .post('/support/report')
        .send({ message: 'Chart did not load', context: { page: '/growth' } })
        .expect(201);
      const inbox = await as('admin').get('/admin/inbox').expect(200);
      const contact = inbox.body.find(
        (m: { kind: string }) => m.kind === 'CONTACT',
      );
      expect(contact.userId).toBe(id.parent);
      expect(
        inbox.body.some((m: { kind: string }) => m.kind === 'PROBLEM'),
      ).toBe(true);
    });
  });

  describe('members', () => {
    it('the parent removes the caretaker, who loses access at once', async () => {
      await as('caretaker')
        .delete(`/children/${childId}/members/${id.doctor}`)
        .expect(403);
      await as('parent')
        .delete(`/children/${childId}/members/${id.caretaker}`)
        .expect(200);
      await as('caretaker').get(`/children/${childId}`).expect(403);
    });

    it('the only parent cannot leave; deleting the child is the way out', async () => {
      await as('parent')
        .delete(`/children/${childId}/members/${id.parent}`)
        .expect(400);
      await as('doctor').delete(`/children/${childId}`).expect(403);
      const xrays = await prisma.boneAgePrediction.findMany({
        where: { childId },
        select: { imageUrl: true },
      });
      const files = xrays.map((x) =>
        join(UPLOADS, x.imageUrl.split('/').pop()!),
      );
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => existsSync(f))).toBe(true);

      await as('parent').delete(`/children/${childId}`).expect(200);
      await as('doctor').get(`/children/${childId}`).expect(403);
      // The rows cascade; the radiographs on disk must go with them.
      expect(files.some((f) => existsSync(f))).toBe(false);
    });
  });

  describe('password change', () => {
    it('signs out every other session and keeps this one', async () => {
      const login = () =>
        http()
          .post('/auth/login')
          .send({ email: 'caretaker@e2e.test', password: PASSWORD })
          .expect(200);
      const otherDevice = (await login()).body.refreshToken as string;
      const thisDevice = (await login()).body.accessToken as string;

      await http()
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${thisDevice}`)
        .send({ currentPassword: 'wrong-Pass1', newPassword: 'Changed123!' })
        .expect(400);
      const res = await http()
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${thisDevice}`)
        .send({ currentPassword: PASSWORD, newPassword: 'Changed123!' })
        .expect(200);

      await http()
        .post('/auth/refresh')
        .send({ refreshToken: otherDevice })
        .expect(401);
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: res.body.refreshToken })
        .expect(200);
    });
  });

  describe('avatar', () => {
    it('keeps every avatar choice, and refuses one out of range', async () => {
      const avatar = {
        skin: 'tan',
        babyHair: 4,
        youngHair: 2,
        hairColor: '#6b4226',
        babyOutfit: 3,
        babyMouth: 4,
        babyEyes: 1,
        babyLashes: 6,
        babyBrows: 2,
        babyShoes: 1,
      };
      const res = await as('parent')
        .post('/children')
        .send({
          fullName: 'Avatar Child',
          sex: 'FEMALE',
          dateOfBirth: '2025-06-01',
          avatar,
        })
        .expect(201);
      expect(res.body.avatar).toEqual(avatar);
      await as('parent')
        .patch(`/children/${res.body.id}`)
        .send({ avatar: { ...avatar, babyMouth: 9 } })
        .expect(400);
      await as('parent').delete(`/children/${res.body.id}`).expect(200);
    });
  });

  describe('invitations are for other people', () => {
    let kidId: string;
    beforeAll(async () => {
      const res = await as('parent')
        .post('/children')
        .send({
          fullName: 'Second Child',
          sex: 'MALE',
          dateOfBirth: '2020-01-01',
        })
        .expect(201);
      kidId = res.body.id;
    });

    it('refuses inviting yourself', async () => {
      const res = await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'DOCTOR', email: 'PARENT@e2e.test' })
        .expect(400);
      expect(res.body.message).toMatch(/cannot invite yourself/);
    });

    it('refuses inviting someone who already follows the child', async () => {
      await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'CARETAKER', email: 'parent@e2e.test' })
        .expect(400);
      const doctorInvite = await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'DOCTOR' })
        .expect(201);
      await as('doctor')
        .post(`/invites/${doctorInvite.body.link.split('/invite/')[1]}/accept`)
        .expect(200);
      const res = await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'DOCTOR', email: 'doctor@e2e.test' })
        .expect(409);
      expect(res.body.message).toMatch(/already follows/);
    });

    it('a second invitation to the same address replaces the first', async () => {
      const first = await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'CARETAKER', email: 'newcomer@e2e.test' })
        .expect(201);
      await as('parent')
        .post(`/children/${kidId}/invites`)
        .send({ role: 'CARETAKER', email: 'newcomer@e2e.test' })
        .expect(201);
      const members = await as('parent')
        .get(`/children/${kidId}/members`)
        .expect(200);
      const waiting = members.body.pendingInvites.filter(
        (i: { email: string }) => i.email === 'newcomer@e2e.test',
      );
      expect(waiting).toHaveLength(1);
      await http()
        .get(`/invites/${first.body.link.split('/invite/')[1]}`)
        .expect(200)
        .expect((r) => expect(r.body.state).toBe('revoked'));
    });
  });

  describe('accounts', () => {
    it('saves the phone number given at registration (FR-1)', async () => {
      const res = await http()
        .post('/auth/register')
        .send({
          email: 'Phone.Person@e2e.test',
          password: PASSWORD,
          fullName: 'Phone Person',
          phoneNumber: '081 234 5678',
          acceptedTerms: true,
        })
        .expect(201);
      expect(res.body.user).toMatchObject({
        email: 'phone.person@e2e.test',
        phoneNumber: '081 234 5678',
        isVerified: false,
        hasPassword: true,
        hasGoogle: false,
      });
    });

    it('refuses disposable email addresses', async () => {
      const res = await http()
        .post('/auth/register')
        .send({
          email: 'someone@mailinator.com',
          password: PASSWORD,
          fullName: 'Throwaway',
          acceptedTerms: true,
        })
        .expect(400);
      expect(res.body.message).toMatch(/disposable/);
    });

    it('a doctor is approved only after confirming their email', async () => {
      const reg = await http()
        .post('/auth/register')
        .send({
          email: 'new.doctor@e2e.test',
          password: PASSWORD,
          fullName: 'New Doctor',
          accountType: 'DOCTOR',
          licenseNumber: 'MD-777',
          hospital: 'Khon Kaen Hospital',
          acceptedTerms: true,
        })
        .expect(201);
      const doctorId = reg.body.user.id as string;
      const res = await as('admin')
        .patch(`/admin/doctors/${doctorId}`)
        .send({ decision: 'APPROVED' })
        .expect(400);
      expect(res.body.message).toMatch(/not confirmed their email/);

      const resent = await http()
        .post('/auth/resend-verification')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .expect(200);
      await http()
        .post('/auth/verify-email')
        .send({ token: resent.body.token })
        .expect(200);
      // Opening the link again (second tab, mail scanner) still says confirmed.
      await http()
        .post('/auth/verify-email')
        .send({ token: resent.body.token })
        .expect(200);
      await http()
        .post('/auth/verify-email')
        .send({ token: 'f'.repeat(64) })
        .expect(400);
      // Even after the link expires, a confirmed address is reported as confirmed.
      await prisma.user.update({
        where: { id: doctorId },
        data: { emailVerifyExpiresAt: new Date(Date.now() - 1000) },
      });
      await http()
        .post('/auth/verify-email')
        .send({ token: resent.body.token })
        .expect(200);
      await as('admin')
        .patch(`/admin/doctors/${doctorId}`)
        .send({ decision: 'APPROVED' })
        .expect(200);
    });

    it('points a Google account to Google, on login and on registration', async () => {
      await prisma.user.create({
        data: {
          email: 'google.only@e2e.test',
          fullName: 'Google Only',
          googleId: 'g-sub-1',
          isVerified: true,
        },
      });
      const login = await http()
        .post('/auth/login')
        .send({ email: 'google.only@e2e.test', password: PASSWORD })
        .expect(401);
      expect(login.body.code).toBe('GOOGLE_ACCOUNT');
      const reg = await http()
        .post('/auth/register')
        .send({
          email: 'google.only@e2e.test',
          password: PASSWORD,
          fullName: 'Someone',
          acceptedTerms: true,
        })
        .expect(409);
      expect(reg.body.code).toBe('GOOGLE_ACCOUNT');
    });

    it('the same refresh token twice (two tabs) keeps both signed in, until a password change', async () => {
      const login = await http()
        .post('/auth/login')
        .send({ email: 'stranger@e2e.test', password: PASSWORD })
        .expect(200);
      const token = login.body.refreshToken as string;
      const [a, b] = await Promise.all([
        http().post('/auth/refresh').send({ refreshToken: token }),
        http().post('/auth/refresh').send({ refreshToken: token }),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);

      await http()
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${a.body.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: 'Changed999!' })
        .expect(200);
      // The rotated token's grace ends with the password change.
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: token })
        .expect(401);
      await http()
        .post('/auth/refresh')
        .send({ refreshToken: b.body.refreshToken })
        .expect(401);
    });

    it('lets a Google account add a password, once', async () => {
      const g = await prisma.user.create({
        data: {
          email: 'google.two@e2e.test',
          fullName: 'Google Two',
          googleId: 'g-sub-2',
          isVerified: true,
        },
      });
      // Sign in as that account by minting a session the way Google sign-in would.
      const jwt = app.get(JwtService);
      const access = await jwt.signAsync(
        { sub: g.id, email: g.email, role: g.role },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      );
      await http()
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${access}`)
        .send({ newPassword: 'Another123!' })
        .expect(200);
      await http()
        .post('/auth/login')
        .send({ email: 'google.two@e2e.test', password: 'Another123!' })
        .expect(200)
        .expect((r) => expect(r.body.user.id).toBe(g.id));
      await http()
        .post('/auth/set-password')
        .set('Authorization', `Bearer ${access}`)
        .send({ newPassword: 'Third1234!' })
        .expect(400);
    });
  });
});
