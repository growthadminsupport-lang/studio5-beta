-- Admin-editable copy and media for the Home page sections.
CREATE TABLE "site_sections" (
    "key" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaPath" TEXT,
    "mediaType" TEXT,
    "crop" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_sections_pkey" PRIMARY KEY ("key")
);
