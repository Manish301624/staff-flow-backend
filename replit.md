# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## StaffFlow — Multi-tenant HRMS SaaS

### Artifacts
- `artifacts/api-server` — Express + PostgreSQL REST API (port 8080)
- `artifacts/staffflow` — React + Vite frontend (port from $PORT)
- `artifacts/staffflow-mobile` — Expo React Native app (preview path `/mobile/`)

### Features Built
- JWT auth (bcryptjs, SESSION_SECRET), multi-tenant via companyId
- Dashboard: KPI cards, Recharts bar/pie, smart insights
- Employees CRUD with department/salary type
- Attendance: calendar bulk-mark, punch in/out
- Salary: Indian payroll (PF 12%, ESI 0.75%, PT slab, TDS), payslip modal with print
- Payments: payment records, quick-add, salary summary
- Leave Management: apply/approve/reject leaves, leave balance tracker (casual/sick/earned)
- Tasks: Kanban board
- Reports: monthly CSV export
- Settings: dark/light theme toggle
- Sidebar nav with Framer Motion animations

### DB Tables (Drizzle schema in lib/db/src/schema/)
- users, companies, employees, attendance, payments, tasks, leaves, leave_balances

### API Codegen
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Generated hooks in: `lib/api-client-react/src/generated/api.ts`
- Orval auto-generates `*Params` types from query params — do NOT define them as schemas

### Auth
- JWT stored in `localStorage` as `staffflow_token` (web) / `expo-secure-store` (native)
- `setAuthTokenGetter` from `@workspace/api-client-react` injects bearer token
- Demo: admin@staffflow.com / password123

### Mobile App — StaffFlow Mobile (Expo SDK 54)
- Stack: expo-router v6, @tanstack/react-query, shared `@workspace/api-client-react`
- Auth: `contexts/AuthContext.tsx` — SecureStore on native, localStorage on web
- Theme: Design tokens synced from web `index.css` (primary #576DFA, dark bg #060B18)
- Tabs: Dashboard, Team, Attendance, Tasks, More
- Platform: NativeTabs (iOS 18+ liquid glass) / BlurView tabs fallback
- Base URL set via `EXPO_PUBLIC_DOMAIN` env var → `setBaseUrl()`

### Important Notes
- `bcryptjs` (pure JS) used instead of native `bcrypt`
- `date-fns` NOT installed in api-server — use vanilla JS for date math in backend routes
- `lib/api-zod/src/index.ts` is overwritten by codegen — post-codegen echo re-fixes it to `export * from "./generated/api";`
