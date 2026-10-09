# Foundation dependency decisions

<!-- MYFARM-STATUS-START -->
- Documentation review: REVIEWED — Phase02 closeout status/link review; content unchanged; no completion inferred from review.
- Implementation status: REFERENCE ONLY — N/A (navigation/protocol/template/decision/evidence record; no directly implementable scope).
- Last reviewed: 2026-10-09 (Africa/Nairobi), Phase02 implementation and closeout session.
- Related phase/task IDs: Phase01 review session; MYF-P01-T001 through MYF-P01-T013; Phase00 owner acceptance where referenced; Phase02 review session (MYF-P02-T001–T013).
- Verified completed work: Reference content/status/evidence links reviewed; document existence or review does not complete implementation tasks.
- Remaining work/blockers: Maintain alignment after Phase01 live verification; historical results stay historical and source body remains immutable.
- Evidence/report links: [Phase02 closeout](../reports/phase-02-closeout-2026-10-09.md); [Phase02 every-document review](../reports/phase-02-document-review-2026-10-09.md); [Phase01 closeout](../reports/phase-01-closeout-2026-10-08.md); [every-document review](../reports/phase-01-document-review-2026-10-08.md); [latest provider/security report](../reports/phase-01-provider-verification-2026-10-08.md).
<!-- MYFARM-STATUS-END -->
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
| ESLint + TypeScript/hooks plugins | Approved lint/import rules; no second linter | Development only; MIT |
| Vitest, jsdom, RTL + jest-dom + user-event | Domain and component verification; no competing unit suite | Development only; MIT |
| Playwright | Mobile/desktop browser verification | Development/browser downloads; Apache-2.0 |
| dotenv | Prisma and isolated test configuration without printing credentials | Tooling only; BSD-2-Clause |

Security and maintenance are checked against the installed lockfile using npm audit; findings and remediation are recorded in the closeout. License descriptions are package metadata, not a legal assessment. No paid account, provider infrastructure or production database is provisioned. Browser code never imports Prisma or private environment configuration.

## Approved provider override

Supabase PostgreSQL + Supabase Auth replaces source-baseline Neon for the active implementation. The source extract remains unchanged. Supabase private storage is an adapter contract; bucket policy and live provider verification require a configured isolated development project. Vercel remains the hosting target; hosted deployment has not been asserted.

## Audit remediation and lockfile verification

Maintained ESLint10.12/typescript-eslint8.71/react-hooks7.1 replaced the Next lint config's unpatched glob/braces chain. Existing boundary and hook rules are preserved. Patched deepmerge-ts8.0.2 and mysql2 3.24.5 override vulnerable development-only Prisma tooling dependencies; generation/migration/typecheck/build pass. Exact compatible @emnapi/wasi-threads1.2.3 override repairs the optional-platform lock entry so npm ci exits0. These are tooling/packaging compatibility choices, not application features.

Final npm audit returns zero vulnerabilities. The Windows npm ls --all diagnostic still reports optional unused Sharp/WASI artifacts despite native Sharp loading and clean install/build passing; this remains recorded for investigation. No force/legacy-peer options or silent audit suppression.
