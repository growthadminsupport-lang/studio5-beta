import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { understandingBoneAge, nutritionForPreTeens, navigatingGrowthSpurts } from './articles-content';

const prisma = new PrismaClient();

async function main() {
  // The same five topics as the Knowledge page's category chips.
  const categories = [
    { name: 'Growth', slug: 'growth' },
    { name: 'Nutrition', slug: 'nutrition' },
    { name: 'Bone Age', slug: 'bone-age' },
    { name: 'Puberty', slug: 'puberty' },
    { name: 'Healthy Habits', slug: 'healthy-habits' },
  ];

  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  const growth = await prisma.category.findUniqueOrThrow({ where: { slug: 'growth' } });
  const nutrition = await prisma.category.findUniqueOrThrow({ where: { slug: 'nutrition' } });
  const boneAge = await prisma.category.findUniqueOrThrow({ where: { slug: 'bone-age' } });

  const articles = [
    {
      categoryId: growth.id,
      title: 'Navigating Growth Spurts (detailed)',
      slug: 'navigating-growth-spurts-detailed',
      summary:
        'When the pubertal growth spurt happens, how fast it goes, and which changes are worth a doctor’s attention.',
      contentMd: navigatingGrowthSpurts,
      tag: 'Article',
    },
    {
      categoryId: nutrition.id,
      title: 'Nutrition for Pre-teens (detailed)',
      slug: 'nutrition-for-pre-teens-detailed',
      summary:
        'Calcium, vitamin D, iron and protein targets for ages 9–13 — and the everyday habits that matter more than any single nutrient.',
      contentMd: nutritionForPreTeens,
      tag: 'Guide',
    },
    {
      categoryId: boneAge.id,
      title: 'Understanding Bone Age (detailed)',
      slug: 'understanding-bone-age-detailed',
      summary:
        'How skeletal maturity is read from a hand X-ray, why a doctor would order one, and the limits of what it can tell you.',
      contentMd: understandingBoneAge,
      tag: 'Explainer',
    },
  ];

  // These three are the longer, fully referenced versions of topics the website already covers
  // with the team's designed pages (frontend/src/content/articles.js). They are seeded as
  // unpublished drafts so the admin can edit and publish them, without a second article on the
  // same topic appearing by surprise.
  //
  // Create only. Once an article exists the admin portal owns it: this seed runs on every
  // deploy, and overwriting here would silently undo whatever an admin changed.
  for (const article of articles) {
    const { slug, ...fields } = article;
    await prisma.article.upsert({
      where: { slug },
      update: {},
      create: { ...fields, slug, publishedAt: null },
    });
  }

  await promoteAdmin();
  if (process.env.SEED_DEMO === 'true') await seedDemo();

  console.log(`Seed complete: ${categories.length} categories, ${articles.length} articles.`);
}

/**
 * ADMIN_EMAIL names the account that gets the admin portal. It is only promoted once its email
 * is verified, which today means it signed in with Google at least once. Otherwise anyone could
 * register that address with a password before its owner did, and be made admin on the next
 * deploy. Sign in with Google as that address, then redeploy (or wait for the next one).
 */
async function promoteAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`ADMIN_EMAIL ${email}: no account yet. Sign in with Google as that address, then redeploy.`);
    return;
  }
  if (!user.isVerified) {
    console.log(`ADMIN_EMAIL ${email}: email not verified. Sign in with Google once, then redeploy.`);
    return;
  }
  if (user.role !== 'ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log(`ADMIN_EMAIL ${email}: promoted to admin.`);
  }
}

/**
 * Demo accounts, one per role, sharing one child, for rehearsing and presenting the flows. Off
 * unless SEED_DEMO=true, and never meant for production: the passwords are in this file.
 */
async function seedDemo() {
  const password = await bcrypt.hash('Demo1234!', 10);
  const people = [
    { email: 'parent@demo.growth', fullName: 'Demo Parent', role: 'USER' as const },
    { email: 'caretaker@demo.growth', fullName: 'Demo Caretaker', role: 'USER' as const },
    { email: 'doctor@demo.growth', fullName: 'Dr Demo', role: 'DOCTOR' as const },
    { email: 'admin@demo.growth', fullName: 'Demo Admin', role: 'ADMIN' as const },
  ];
  const ids: Record<string, string> = {};
  for (const p of people) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        ...p,
        passwordHash: password,
        phoneNumber: '0800000000',
        termsAcceptedAt: new Date(),
        ...(p.role === 'DOCTOR'
          ? { doctorStatus: 'APPROVED' as const, licenseNumber: 'DEMO-0001', hospital: 'Demo Hospital' }
          : {}),
      },
    });
    ids[p.email] = user.id;
  }
  const existing = await prisma.childGuardian.findFirst({
    where: { userId: ids['parent@demo.growth'], role: 'PARENT' },
  });
  if (existing) return;
  await prisma.child.create({
    data: {
      fullName: 'Demo Child',
      nickname: 'Demo',
      sex: 'FEMALE',
      dateOfBirth: new Date(Date.now() - 9.5 * 365.25 * 24 * 60 * 60 * 1000),
      hn: 'HN-DEMO-001',
      guardians: {
        create: [
          { userId: ids['parent@demo.growth'], role: 'PARENT', isPrimary: true },
          { userId: ids['caretaker@demo.growth'], role: 'CARETAKER', isPrimary: false, relation: 'GUARDIAN' },
          { userId: ids['doctor@demo.growth'], role: 'DOCTOR', isPrimary: false, relation: 'GUARDIAN' },
        ],
      },
    },
  });
  console.log('Demo accounts seeded (password Demo1234!).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
