# MiBloque App

Aplicacion web para administracion de bloques/condominios con paneles para `superadmin`, `admin` y `vecino`.

## Stack

- Next.js `16.2.4` (App Router)
- React `19.2.4`
- Supabase (Auth + Postgres + Storage)
- TypeScript + ESLint

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Variables de entorno

Crea `.env.local` con:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_THEME=ocean
NEXT_PUBLIC_ENABLE_DEMO=false
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` es necesaria para flujos de superadmin (creacion/edicion de usuarios sin email flow).
- `NEXT_PUBLIC_ENABLE_DEMO=true` muestra el acceso Demo en el landing. En produccion se recomienda `false`.

## Estructura principal

- `app/`: rutas y layouts (admin, vecino, superadmin, demo, api)
- `components/`: componentes reutilizables de UI
- `lib/`: auth, supabase clients y utilidades (incluye generador PDF)
- `supabase/migrations/`: migraciones SQL versionadas

## Verificacion recomendada antes de deploy

1. `npm run lint`
2. `npm run build`
3. Revisar que `.env.local` no tenga secretos de prueba

