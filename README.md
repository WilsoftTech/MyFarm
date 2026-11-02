# MyFarm
Keep accurate farm records, track income & expenses, manage resources, monitor performance and improve farm profitability.

Supabase PostgreSQL + Supabase Auth, Next.js App Router, strict TypeScript and Prisma. Phases 1-6 are implemented with documented deployment conditions. Phase 6 adds farm activities, repeating activities and a month calendar; all 10 tasks and the GitHub-hosted quality workflow pass. Phase 5 adds harvest, poultry production, stock movements and reconstruction; all 13 tasks and the GitHub-hosted quality workflow pass.

Read [project status](docs/PROJECT-STATUS.md), [Phase 6](docs/phases/phase-06-farm-activities.md) and [local setup](docs/engineering/foundation-local-setup.md).

```powershell
npm ci
Copy-Item .env.example .env.local
# Configure isolated development credentials, then:
npm run dev
```

Never commit .env.local or use production credentials for tests. Protected application routes fail closed when authentication or account membership is unavailable. Runtime env configuration is required; builds do not require credentials.

Phase 4, 5 and 6 database changes are applied to hosted development only; production is a separate gate. See the [Phase 6 audit and hosted evidence](docs/reports/phase-06-closeout-2026-11-03.md) and [Phase 5 notes](docs/reports/phase-05-closeout-2026-10-29.md). Inventory values are not yet costed; durable offline synchronization remains Phase 7.
