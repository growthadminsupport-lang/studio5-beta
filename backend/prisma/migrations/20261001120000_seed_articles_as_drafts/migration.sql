-- The website now shows the team's designed pages for these three topics, under these slugs.
-- The seeded text versions become unpublished drafts under new slugs, so the admin portal can
-- still edit and publish them without the two colliding on /knowledge/<slug>.
UPDATE "articles"
SET "slug" = "slug" || '-detailed',
    "title" = "title" || ' (detailed)',
    "publishedAt" = NULL
WHERE "slug" IN ('navigating-growth-spurts', 'nutrition-for-pre-teens', 'understanding-bone-age');
