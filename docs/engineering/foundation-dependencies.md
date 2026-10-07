# Foundation dependency decisions
Phase 01, 2026-10-08. No package manifest, lockfile, implementation or reusable application components existed at inspection. Root AGENTS.md, CLAUDE.md and Designs.md were preserved.

The user approved the documented Next.js/React/TypeScript/Tailwind/shadcn/Zod/React Hook Form/Prisma/Vitest/RTL/Playwright stack and explicitly selected Supabase PostgreSQL + Supabase Auth. Exact package versions are recorded in package.json and package-lock.json. Prisma 7 stable was selected instead of the registry's Prisma 8 release candidate.

| Dependencies | Purpose / alternative | Impact and license |
|---|---|---|
| Next.js, React, React DOM | Approved App Router/runtime; no competing web framework | Framework runtime/client shell; MIT |
| TypeScript, @types packages | Strict contracts/tooling; JavaScript alone cannot enforce DTO types | Development only; Apache-2.0 / MIT |
| Tailwind + PostCSS adapter | Approved token styling; no second CSS framework | Compiled CSS, development build tooling; MIT |
| Radix Slot, class-variance-authority, clsx, tailwind-merge | shadcn-compatible reusable button/input; avoids duplicate component styles | Small client helpers; MIT |
| Zod, RHF, resolvers | Same validated DTO at client/server boundary, accessible form state | Form-only client dependencies; MIT |
| Supabase JS + SSR | Explicitly approved authentication, cookie/session refresh, private storage adapter | SSR cookies and provider client; MIT |
| Prisma client, adapter-pg, pg | Approved ORM with Prisma 7 driver adapter; no alternate ORM | Server-only connection pool/runtime; Apache-2.0 / MIT |
| server-only | Build-time prevention of privileged client imports | Marker package; MIT |
| ESLint + Next config | Approved lint/import rules; no second linter | Development only; MIT |
| Vitest, jsdom, RTL + jest-dom + user-event | Domain and component verification; no competing unit suite | Development only; MIT |
| Playwright | Mobile/desktop browser verification | Development/browser downloads; Apache-2.0 |
| dotenv | Prisma and isolated test configuration without printing credentials | Tooling only; BSD-2-Clause |

Security and maintenance are checked against the installed lockfile using npm audit; findings and remediation are recorded in the closeout. License descriptions are package metadata, not a legal assessment. No paid account, provider infrastructure or production database is provisioned. Browser code never imports Prisma or private environment configuration.

## Approved provider override

Supabase PostgreSQL + Supabase Auth replaces source-baseline Neon for the active implementation. The source extract remains unchanged. Supabase private storage is an adapter contract; bucket policy and live provider verification require a configured isolated development project. Vercel remains the hosting target; hosted deployment has not been asserted.
