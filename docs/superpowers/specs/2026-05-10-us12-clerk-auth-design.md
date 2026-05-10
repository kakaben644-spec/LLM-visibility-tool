# US-12 — Authentification Clerk + blocage emails jetables

**Date :** 2026-05-10
**Statut :** Approuvé
**Stack :** Clerk V2 + Next.js 16 App Router + Supabase

---

## Objectif

Activer l'authentification Clerk dans GEO Doctor, protéger les routes `/dashboard` et `/recommendations`, bloquer les emails jetables, et migrer la session anonyme de l'utilisateur vers son compte Clerk après inscription.

---

## Architecture

### Fichiers créés / modifiés

```
middleware.ts                                    ← nouveau (racine projet)
app/layout.tsx                                   ← ajout <ClerkProvider>
app/(auth)/layout.tsx                            ← nouveau (page centrée fond sombre)
app/(auth)/sign-up/[[...sign-up]]/page.tsx       ← nouveau
app/(auth)/sign-in/[[...sign-in]]/page.tsx       ← nouveau
app/(auth)/post-sign-up/page.tsx                 ← nouveau (migration session)
app/api/auth/migrate-session/route.ts            ← nouveau
app/api/webhooks/clerk/route.ts                  ← nouveau
.env.local                                       ← ajout variables NEXT_PUBLIC_CLERK_*
```

### Dépendances à installer

```bash
npm install @clerk/nextjs svix
```

- `@clerk/nextjs` — SDK Clerk pour Next.js (absent de package.json malgré la note CLAUDE.md)
- `svix` — vérification de signature des webhooks Clerk

---

## Flux utilisateur nominal

```
Landing (/) → Onboarding → Scanning → mini-dashboard
→ "Voir les recommandations" → /sign-up
→ Clerk crée le compte
→ Webhook user.created : vérification email (suppression si jetable)
→ Redirect /post-sign-up (page intermédiaire)
→ migrate_session(session_token, user_id) via API
→ Redirect /recommendations
```

### Flux sign-in (retour utilisateur)

```
/sign-in → Clerk authentifie → redirect /recommendations
```

---

## Section 1 — Middleware & protection des routes

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/recommendations(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

**Routes publiques :** `/`, `/step-*`, `/scanning`, `/sign-up`, `/sign-in`, `/post-sign-up`, `/api/*`

**Comportement :**
- Non-authentifié sur route protégée → redirect automatique `/sign-in`
- Après sign-in → Clerk redirige vers l'URL d'origine

**Variables `.env.local` :**
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/post-sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations
```

---

## Section 2 — Pages auth (Clerk natif themé)

### Layout `(auth)`
Page centrée, fond `#0a0a0a` (dark GEO Doctor).

### `/sign-up` et `/sign-in`
Composants `<SignUp />` / `<SignIn />` de Clerk avec `appearance` prop :
```typescript
appearance={{
  variables: { colorPrimary: "#7c3aed", colorBackground: "#18181b" }
}}
```

### `/post-sign-up` (Client Component)
Page intermédiaire invisible (spinner), exécute :
1. Lecture de `llmv_session` depuis `localStorage`
2. Récupération du `userId` Clerk via `useAuth()`
3. Appel `POST /api/auth/migrate-session` avec `{ session_token, user_id }`
4. Redirect vers `/recommendations` (toujours, succès ou échec — migration best-effort)

### `POST /api/auth/migrate-session`
- Vérifie l'auth Clerk server-side via `auth()`
- Appelle `supabase.rpc("migrate_session", { p_session_token, p_user_id })`
- Retourne `{ ok: true }` ou `{ ok: false, error: string }` sans jamais lever d'exception bloquante

---

## Section 3 — Blocage emails jetables (A + C)

### Couche C — Blocklist Clerk native (sans code)
Configuration dans le dashboard Clerk → Restrictions → Email domain blocklist :
```
mailinator.com, tempmail.com, guerrillamail.com, yopmail.com,
10minutemail.com, throwam.com, trashmail.com, sharklasers.com,
guerrillamail.info, grr.la, guerrillamail.biz, spam4.me,
dispostable.com, maildrop.cc, fakeinbox.com
```

### Couche A — Webhook `POST /api/webhooks/clerk`
Event écouté : `user.created`

Logique :
1. Vérifier la signature Clerk via `svix` → 401 si invalide
2. Extraire `email_addresses[0].email_address`
3. Comparer le domaine contre une liste étendue (~150 domaines jetables embarquée dans le code)
4. Si jetable → `clerkClient.users.deleteUser(userId)` → retourner 200
5. Si légitime → retourner 200 sans action

**Variable `.env.local` nécessaire :** `CLERK_WEBHOOK_SECRET` (déjà présente)

---

## Ce qui n'est pas couvert (backlog V2)

- Validation en temps réel pendant la saisie (API tierce type ZeroBounce)
- Migration de session au sign-in (multi-appareils)
- Layout dashboard authentifié avec sidebar (US-13)

---

## Critères de succès

- [ ] `npm run build` passe sans erreur TypeScript
- [ ] `/dashboard` et `/recommendations` redirigent vers `/sign-in` si non-authentifié
- [ ] Sign-up avec email jetable (mailinator.com) → compte supprimé
- [ ] Sign-up nominal → migration session → atterrissage sur `/recommendations`
- [ ] Sign-in → atterrissage sur `/recommendations`
