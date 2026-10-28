# MyFarm
Keep accurate farm records, track income & expenses, manage resources, monitor performance and improve farm profitability.

Supabase PostgreSQL + Supabase Auth, Next.js App Router, strict TypeScript and Prisma. Phases 1-4 are implemented and owner-accepted with documented conditions. Phase 5 adds harvest, poultry production, stock movements and reconstruction; its final audit requires passing hosted CI before closure.

Read [project status](docs/PROJECT-STATUS.md), [Phase 5](docs/phases/phase-05-harvest-inventory.md) and [local setup](docs/engineering/foundation-local-setup.md).

```powershell
npm ci
Copy-Item .env.example .env.local
# Configure isolated development credentials, then:
npm run dev
```

Never commit .env.local or use production credentials for tests. Protected application routes fail closed when authentication or account membership is unavailable. Runtime env configuration is required; builds do not require credentials.

Phase 5 changes are local until separately authorized hosted migration/provisioning. See the [audit and migration notes](docs/reports/phase-05-closeout-2026-10-29.md). Inventory values are not yet costed; durable offline synchronization remains Phase 7.
