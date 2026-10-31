# society-web

Frontend for SocietyApp: Next.js (App Router), TypeScript and Tailwind CSS, with the V2 Liquid Glass design tokens.
Module 01 (project foundation) provides the structure only. Screens and components are added by their own modules.

## Start

```bash
npm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL points at society-api
npm run dev                        # http://localhost:3000
```

## Scripts

`npm run dev`, `build`, `start`, `typecheck`, `lint`, `format`.

## Layout

```
src/
  app/
    (public)/      sign in, OTP, reset password, invite (all hosts)
    (platform)/    Super Admin console       platform.societyapp.in   (path prefix /platform on localhost)
    (admin)/       Society admin app         admin.societyapp.in      (/admin)
    (resident)/    Resident app (PWA)        my.societyapp.in         (/resident)
    (gate)/        Guard console (PWA)       gate.societyapp.in       (/gate)
    (work)/        Staff and vendor app      work.societyapp.in       (/work)
  components/ui/ components/common/   primitives and shared components
  hooks/  lib/  services/  types/  constants/
  proxy.ts        maps the host to the route group; unknown hosts get 404
```

Rules: every network call lives in `services/` and goes through `lib/apiClient.ts`; components never call `fetch`.
Money is integer paise and is formatted only by `MoneyText`.

## Git

`main` is production, `dev` is integration, work happens on `module/<NN>-<name>` branches made from `dev`
(see `CODING_STANDARDS.md` section 4.4).
