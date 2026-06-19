# Staging Trial Deployment

Use this workflow when Kid Seeds Hub is deployed for the center to try on a Vercel URL before the real `kidseedhub.edu.vn` go-live.

## Boundaries

- Branch: deploy trial from `staging`; keep `master` as the production baseline.
- URL: use the Vercel deployment URL first. Do not point `kidseedhub.edu.vn` until trial smoke checks pass.
- Database: use a dedicated staging/pre-production Postgres database. Do not share local, demo, or future production databases.
- Data: trial data may be kept later, so do not run demo seed against the trial database.
- Secrets: staging and future production must use different database URLs, auth secrets, and storage credentials.

## Required Environment

Set these in the Vercel environment used by `staging` without printing secret values in logs:

- `KIDSEEDSHUB_ENVIRONMENT=staging`
- `DATABASE_URL`: runtime Postgres URL for the staging database.
- `DIRECT_URL`: direct Postgres URL used for Prisma migrations.
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `NEXTAUTH_URL`: Vercel trial URL until a real domain is attached.
- `CLASS_PHOTO_UPLOAD_DRIVER=cloudinary`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_UPLOAD_PRESET` or `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`
- `CLOUDINARY_CLASS_PHOTO_FOLDER=kidseedshub/staging/class-photos`
- `KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS=res.cloudinary.com`

## First Deploy

1. Confirm the working tree has no unrelated changes staged.
2. Push `staging` to GitHub.
3. Create/import the Vercel project from this repo and select `staging` as the deploy branch.
4. Create a dedicated Postgres database for staging.
5. Add the required environment variables to Vercel.
6. Run migrations against staging:

```bash
DATABASE_URL="$DIRECT_URL" DIRECT_URL="$DIRECT_URL" npm run prisma:migrate:deploy
```

7. Bootstrap the first real admin only:

```bash
KIDSEEDSHUB_SEED_MODE=production \
KIDSEEDSHUB_ADMIN_NAME="Admin" \
KIDSEEDSHUB_ADMIN_PHONE="..." \
KIDSEEDSHUB_ADMIN_EMAIL="..." \
KIDSEEDSHUB_ADMIN_PASSWORD="..." \
npm run prisma:seed:production
```

8. Run release smoke against the Vercel URL:

```bash
KIDSEEDSHUB_RELEASE_URL="https://..." \
KIDSEEDSHUB_EXPECT_PRODUCTION_UI=true \
npm run release:smoke
```

## Promotion Rules

- Keep center trial changes on `staging` until reviewed.
- Merge or cherry-pick to `master` only after lint, typecheck, build, migration status, and smoke checks pass.
- Before using `kidseedhub.edu.vn`, back up the staging database and decide whether to promote it or create a clean production database.
- Never attach the real domain to a deployment using demo seed data.
