# MyFarm
Keep accurate farm records, track income & expenses, manage resources, monitor performance and improve farm profitability.

Phase 1 engineering foundation. Supabase PostgreSQL + Supabase Auth, Next.js App Router, strict TypeScript and Prisma. Phase 2 farm registration is not implemented.

Read [project status](docs/PROJECT-STATUS.md), [Phase 1](docs/phases/phase-01-engineering-foundation.md) and [local setup](docs/engineering/foundation-local-setup.md).

```powershell
npm ci
Copy-Item .env.example .env.local
# Configure isolated development credentials, then:
npm run dev
```

Never commit .env.local or use production credentials for tests. Protected application routes fail closed when authentication or account membership is unavailable. Runtime env configuration is required; builds do not require credentials.
