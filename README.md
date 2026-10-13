# MetaBev Performance Appraisal Portal

A staff performance review application for MetaBev. Staff complete mid-year and
final-year review forms; managers rate and sign off; administrators manage the
staff registry and export reports.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS (build-time) + Supabase (data) + Netlify (hosting)

## Project structure

```
App.tsx                      Root component: login, routing between roles, cloud sync
components/
  AssessmentForm.tsx         Staff-facing multi-stage review form
  AppraisalReport.tsx        Manager-facing review/rating report (also renders PDFs)
  AdminDashboard.tsx         Manager/Admin hub: submissions, registry, CSV upload, exports
  DebouncedTextarea.tsx      Shared autosaving textarea
  Layout.tsx                 Header/footer chrome + logo
services/
  supabase.ts                All database access (Supabase)
constants.ts                  Rating scale, competencies, record factory
types.ts                      Shared TypeScript types
netlify.toml                  Deploy configuration (build command, SPA redirects)
supabase/                     SQL migrations + user import script (security upgrade)
```

## Local development

1. Install Node.js 20+
2. `npm install`
3. `cp .env.example .env.local` and fill in your Supabase URL + anon key
   (Supabase Dashboard -> Settings -> API)
4. `npm run dev` -> http://localhost:3000
5. `npm run build` / `npm run preview` to check a production build
6. `npm run lint` typechecks the project

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Netlify env vars + `.env.local` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Netlify env vars + `.env.local` | Supabase public (anon) key |

The anon key is designed to be public-facing; actual data protection comes from
Row Level Security policies in Supabase (see `supabase/`).

## How updates get deployed

1. Changes are committed to the `main` branch on GitHub
2. Netlify watches `main` and redeploys automatically
3. GitHub Actions runs typecheck + build on every push as a safety net

## Security model (current + target)

- **Current (interim):** the app authenticates users in the browser against
  records fetched from Supabase using the public anon key. Row Level Security
  must be treated as the real fix - see `supabase/SECURITY_UPGRADE.md` for the
  migration plan that moves logins to Supabase Auth and locks every row down.
- **Target:** Supabase Auth issues each staff member/manager a real session;
  RLS policies restrict every read/write to rows the signed-in user owns or
  manages. Browser-side password checks and plaintext password storage are
  removed completely.
