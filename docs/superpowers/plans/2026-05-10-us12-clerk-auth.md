# US-12 — Authentification Clerk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer Clerk V2 dans GEO Doctor — protéger `/dashboard` et `/recommendations`, créer les pages auth, bloquer les emails jetables via webhook + blocklist native, et migrer la session anonyme après sign-up.

**Architecture:** Middleware-based — `middleware.ts` à la racine gère toutes les redirections auth. Les pages `/sign-up` et `/sign-in` utilisent les composants Clerk natifs themés dark. Une page intermédiaire `/post-sign-up` déclenche la migration de session via `supabase.rpc("migrate_session")` avant de rediriger vers `/recommendations`.

**Tech Stack:** `@clerk/nextjs` (V2/v6), `svix` (vérification webhook), Next.js 16 App Router, Supabase, Zod, TypeScript strict

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `package.json` | Modify | Ajout deps `@clerk/nextjs` + `svix` |
| `.env.local` | Modify | Variables `NEXT_PUBLIC_CLERK_*_URL` |
| `middleware.ts` | Create | Protection routes `/dashboard` et `/recommendations` |
| `app/layout.tsx` | Modify | Wrapper `<ClerkProvider>` |
| `app/(auth)/layout.tsx` | Create | Layout centré fond sombre pour pages auth |
| `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | Create | Page sign-up Clerk themée |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | Create | Page sign-in Clerk themée |
| `app/(auth)/post-sign-up/page.tsx` | Create | Page intermédiaire migration session |
| `app/api/auth/migrate-session/route.ts` | Create | Route API migration session anonyme → Clerk |
| `lib/disposable-email-domains.ts` | Create | Liste ~100 domaines emails jetables |
| `app/api/webhooks/clerk/route.ts` | Create | Webhook `user.created` → blocage emails jetables |

---

## Task 1 : Installation des dépendances

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Étape 1 : Installer les packages**

```bash
cd /Users/karide/llm-visibility-tool
npm install @clerk/nextjs svix
```

Sortie attendue : `added N packages` sans erreur.

- [ ] **Étape 2 : Vérifier l'installation**

```bash
grep -E '"@clerk/nextjs"|"svix"' package.json
```

Sortie attendue :
```
"@clerk/nextjs": "^6.x.x",
"svix": "^1.x.x"
```

- [ ] **Étape 3 : Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: [US-12 étape 1] — install @clerk/nextjs et svix"
```

---

## Task 2 : Variables d'environnement

**Files:**
- Modify: `.env.local`

- [ ] **Étape 1 : Ajouter les variables Clerk au fichier `.env.local`**

Ajouter à la fin du fichier `.env.local` (ne pas supprimer les variables existantes) :

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/post-sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations
```

Les variables `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` et `CLERK_WEBHOOK_SECRET` sont déjà présentes — ne pas les dupliquer.

- [ ] **Étape 2 : Vérifier**

```bash
grep "NEXT_PUBLIC_CLERK" /Users/karide/llm-visibility-tool/.env.local
```

Sortie attendue : 5 lignes (publishable key + 4 URL vars).

---

## Task 3 : ClerkProvider dans le root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Étape 1 : Remplacer le contenu de `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GEO Doctor — Visibilité IA pour votre marque",
  description:
    "Mesurez et améliorez la présence de votre marque dans ChatGPT, Claude, Gemini et Perplexity. Auditez votre visibilité IA en 2 minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add app/layout.tsx
git commit -m "feat: [US-12 étape 3] — ajout ClerkProvider dans root layout"
```

---

## Task 4 : Middleware de protection des routes

**Files:**
- Create: `middleware.ts` (racine du projet, à côté de `package.json`)

- [ ] **Étape 1 : Créer `middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/recommendations(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Tester manuellement**

Démarrer le serveur : `npm run dev:local`

Naviguer vers `http://localhost:3000/recommendations` sans être connecté.
Résultat attendu : redirect automatique vers `/sign-in` (404 pour l'instant car la page n'existe pas encore — c'est normal).

- [ ] **Étape 4 : Commit**

```bash
git add middleware.ts
git commit -m "feat: [US-12 étape 4] — middleware Clerk protection /dashboard et /recommendations"
```

---

## Task 5 : Layout et pages auth

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `app/(auth)/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Étape 1 : Créer le layout auth `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      {children}
    </div>
  );
}
```

- [ ] **Étape 2 : Créer la page sign-up**

Créer les dossiers : `app/(auth)/sign-up/[[...sign-up]]/`

Créer `app/(auth)/sign-up/[[...sign-up]]/page.tsx` :

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#18181b",
          colorText: "#ffffff",
          colorTextSecondary: "#a1a1aa",
          colorInputBackground: "#27272a",
          colorInputText: "#ffffff",
        },
      }}
    />
  );
}
```

- [ ] **Étape 3 : Créer la page sign-in**

Créer les dossiers : `app/(auth)/sign-in/[[...sign-in]]/`

Créer `app/(auth)/sign-in/[[...sign-in]]/page.tsx` :

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          colorBackground: "#18181b",
          colorText: "#ffffff",
          colorTextSecondary: "#a1a1aa",
          colorInputBackground: "#27272a",
          colorInputText: "#ffffff",
        },
      }}
    />
  );
}
```

- [ ] **Étape 4 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 5 : Tester manuellement**

Démarrer `npm run dev:local`.
- Naviguer `http://localhost:3000/sign-up` → formulaire Clerk dark violet visible
- Naviguer `http://localhost:3000/sign-in` → formulaire Clerk dark violet visible
- Naviguer `http://localhost:3000/recommendations` sans auth → redirect vers `/sign-in` ✓

- [ ] **Étape 6 : Commit**

```bash
git add "app/(auth)/layout.tsx" "app/(auth)/sign-up/[[...sign-up]]/page.tsx" "app/(auth)/sign-in/[[...sign-in]]/page.tsx"
git commit -m "feat: [US-12 étape 5] — pages sign-up et sign-in Clerk dark theme"
```

---

## Task 6 : Route API migrate-session

**Files:**
- Create: `app/api/auth/migrate-session/route.ts`

- [ ] **Étape 1 : Créer `app/api/auth/migrate-session/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/utils/api-error";

const bodySchema = z.object({
  session_token: z.string().uuid("session_token doit être un UUID valide"),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("Non authentifié", "UNAUTHORIZED", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps JSON invalide", "VALIDATION_ERROR", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, "VALIDATION_ERROR", 400);
  }

  const { session_token } = parsed.data;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("migrate_session", {
    p_session_token: session_token,
    p_user_id: userId,
  });

  if (error) {
    console.error("[migrate-session] Supabase RPC error:", error.message);
    return successResponse({ ok: false, error: error.message });
  }

  return successResponse({ ok: true });
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add "app/api/auth/migrate-session/route.ts"
git commit -m "feat: [US-12 étape 6] — route API POST /api/auth/migrate-session"
```

---

## Task 7 : Page post-sign-up (migration de session)

**Files:**
- Create: `app/(auth)/post-sign-up/page.tsx`

- [ ] **Étape 1 : Créer `app/(auth)/post-sign-up/page.tsx`**

```tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PostSignUpPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      router.replace("/sign-up");
      return;
    }

    const migrate = async () => {
      const sessionToken =
        typeof window !== "undefined"
          ? localStorage.getItem("llmv_session")
          : null;

      if (sessionToken) {
        await fetch("/api/auth/migrate-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        }).catch(() => {
          // Migration best-effort : on redirige quoi qu'il arrive
        });
      }

      router.replace("/recommendations");
    };

    migrate();
  }, [isLoaded, userId, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/60 text-sm animate-pulse">Chargement…</p>
    </div>
  );
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Tester le flux complet**

Démarrer `npm run dev:local`.
1. Aller sur `http://localhost:3000/sign-up`
2. Créer un compte avec un email réel
3. Après sign-up → redirect automatique vers `/post-sign-up` (spinner bref) → redirect vers `/recommendations`
4. Vérifier dans Supabase : la session est migrée (si `llmv_session` présent en localStorage)

- [ ] **Étape 4 : Commit**

```bash
git add "app/(auth)/post-sign-up/page.tsx"
git commit -m "feat: [US-12 étape 7] — page post-sign-up migration session"
```

---

## Task 8 : Liste des domaines emails jetables

**Files:**
- Create: `lib/disposable-email-domains.ts`

- [ ] **Étape 1 : Créer `lib/disposable-email-domains.ts`**

```typescript
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.net",
  "guerrillamail.de",
  "guerrillamail.org",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "yopmail.com",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "throwam.com",
  "trashmail.com",
  "trashmail.me",
  "trashmail.net",
  "trashmail.at",
  "trashmail.io",
  "sharklasers.com",
  "spam4.me",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnull.com",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "mytemp.email",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "spamfree24.org",
  "spamfree24.de",
  "spamfree24.eu",
  "spamfree24.info",
  "spamfree24.net",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "fudgerub.com",
  "lookugly.com",
  "mommail.de",
  "nickymail.com",
  "rppkn.com",
  "smellfear.com",
  "spamherelots.com",
  "spamhereplease.com",
  "stuffmail.de",
  "supergreatmail.com",
  "suremail.info",
  "thisisnotmyrealemail.com",
  "tradermail.info",
  "xemaps.com",
  "xsmail.com",
  "yuurok.com",
  "zetmail.com",
  "0-mail.com",
  "0815.ru",
  "0clickemail.com",
  "0wnd.net",
  "0wnd.org",
  "10mail.org",
  "20minutemail.com",
  "filzmail.com",
  "getairmail.com",
  "gishpuppy.com",
  "gmal.com",
  "harakirimail.com",
  "hatespam.org",
  "hidemail.de",
  "jetable.com",
  "jetable.net",
  "jetable.org",
  "kasmail.com",
  "kaspop.com",
  "killmail.com",
  "killmail.net",
  "klzlk.com",
  "kurzepost.de",
  "letthemeatspam.com",
  "lol.ovpn.to",
  "lortemail.dk",
  "lovemeleaveme.com",
  "lr78.com",
  "mt2009.com",
  "mt2014.com",
  "mycleaninbox.net",
  "mypartyclip.de",
  "myphantomemail.com",
  "mysamp.de",
  "nospamfor.us",
  "nospamthanks.info",
  "notmailinator.com",
  "obobbo.com",
  "oneoffemail.com",
  "onewaymail.com",
  "pookmail.com",
  "privacy.net",
  "proxymail.eu",
  "punkass.com",
  "rcpt.at",
  "recode.me",
  "recursor.net",
  "safe-mail.net",
  "sandelf.de",
  "sast.ro",
  "sendspamhere.com",
  "sharedmailbox.org",
  "shitmail.de",
  "shitmail.org",
  "sinnlos-mail.de",
  "slaskpost.se",
  "slipry.net",
  "sneakemail.com",
  "sofort-mail.de",
  "soodonims.com",
  "spam.la",
  "spamavert.com",
  "spambox.us",
  "spamcannon.com",
  "spamcannon.net",
  "spamcon.org",
  "spamcorptastic.com",
  "spamcowboy.com",
  "spamcowboy.net",
  "spamcowboy.org",
  "spamday.com",
  "spamex.com",
  "spamfree.eu",
  "spamgoes.in",
  "spamhole.com",
  "spamify.com",
  "spaminator.de",
  "spamkill.info",
  "spaml.com",
  "spaml.de",
  "spammotel.com",
  "spammy.host",
  "spamoff.de",
  "spamsalad.in",
  "spamsphere.com",
  "spamspot.com",
  "spamstack.net",
  "spamthisplease.com",
  "spamtrail.com",
  "spamtrap.ro",
  "spamtroll.net",
  "speed.1s.fr",
  "supermailer.jp",
  "sweetxxx.de",
  "tamplemail.com",
  "tempe-mail.com",
  "tempemail.biz",
  "tempemail.com",
  "tempemail.net",
  "tempinbox.co.uk",
  "tempinbox.com",
  "tempomail.fr",
  "temporaryemail.net",
  "temporaryemail.us",
  "temporaryforwarding.com",
  "temporaryinbox.com",
  "temporarymailaddress.com",
  "thankyou2010.com",
  "throwam.com",
  "throwasway.com",
  "throwspam.com",
  "tilien.com",
  "tittbit.in",
  "tmail.com",
  "tmail.ws",
  "tmailinator.com",
  "toiea.com",
  "trashdevil.com",
  "trashdevil.de",
  "trashemail.de",
  "trashimail.de",
  "trashmail.me",
  "uroid.com",
  "veryrealemail.com",
  "viditag.com",
  "viewcastmedia.com",
  "viewcastmedia.net",
  "viewcastmedia.org",
  "webm4il.info",
  "wegwerfmail.de",
  "wegwerfmail.net",
  "wegwerfmail.org",
  "wh4f.org",
  "whopy.com",
  "wilemail.com",
  "willhackforfood.biz",
  "willselfdestruct.com",
  "wmail.cf",
  "wolfsmail.tk",
  "wronghead.com",
  "wuzupmail.net",
  "xagloo.co",
  "xagloo.com",
  "xmail.net",
  "xmaily.com",
  "xn--9kq967c.com",
  "xsmail.com",
  "xyzfree.net",
  "yapped.net",
  "yeah.net",
  "yogamaven.com",
  "yopmail.pp.ua",
  "yourdomain.com",
  "yuurok.com",
  "z1p.biz",
  "za.com",
  "zehnminutenmail.de",
  "zippymail.info",
  "zoemail.net",
  "zoemail.org",
  "zomg.info",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Commit**

```bash
git add lib/disposable-email-domains.ts
git commit -m "feat: [US-12 étape 8] — liste domaines emails jetables"
```

---

## Task 9 : Webhook Clerk — blocage emails jetables

**Files:**
- Create: `app/api/webhooks/clerk/route.ts`

- [ ] **Étape 1 : Créer `app/api/webhooks/clerk/route.ts`**

```typescript
import { Webhook } from "svix";
import { headers } from "next/headers";
import { clerkClient } from "@clerk/nextjs/server";
import { isDisposableEmail } from "@/lib/disposable-email-domains";

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
  };
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET manquant");
    return new Response("Configuration serveur manquante", { status: 500 });
  }

  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Headers svix manquants", { status: 400 });
  }

  const body = await req.text();

  const wh = new Webhook(webhookSecret);
  let evt: ClerkUserCreatedEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return new Response("Signature invalide", { status: 401 });
  }

  if (evt.type !== "user.created") {
    return new Response("Event ignoré", { status: 200 });
  }

  const primaryEmail = evt.data.email_addresses[0]?.email_address;
  if (!primaryEmail) {
    return new Response("Email introuvable", { status: 200 });
  }

  if (isDisposableEmail(primaryEmail)) {
    console.warn(
      `[clerk-webhook] Email jetable détecté : ${primaryEmail} — suppression compte ${evt.data.id}`
    );
    const client = await clerkClient();
    await client.users.deleteUser(evt.data.id);
  }

  return new Response("OK", { status: 200 });
}
```

- [ ] **Étape 2 : Vérifier TypeScript**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 3 : Configurer le webhook dans le dashboard Clerk**

Dans le dashboard Clerk (https://dashboard.clerk.com) :
1. Aller dans **Webhooks** → **Add Endpoint**
2. URL : `https://project-n1zex.vercel.app/api/webhooks/clerk`
3. Événement à sélectionner : `user.created`
4. Copier le **Signing Secret** → vérifier qu'il correspond à `CLERK_WEBHOOK_SECRET` dans `.env.local` (déjà présent : `whsec_nFA0cdm99dSC+sHdYnUIc92DfzsdgfHP`)

- [ ] **Étape 4 : Configurer la blocklist Clerk native**

Dans le dashboard Clerk :
1. Aller dans **User & Authentication** → **Restrictions** → **Email domain blocklist**
2. Ajouter ces domaines :
   ```
   mailinator.com
   tempmail.com
   guerrillamail.com
   yopmail.com
   10minutemail.com
   throwam.com
   trashmail.com
   sharklasers.com
   guerrillamail.info
   grr.la
   guerrillamail.biz
   spam4.me
   dispostable.com
   maildrop.cc
   fakeinbox.com
   ```

- [ ] **Étape 5 : Commit**

```bash
git add "app/api/webhooks/clerk/route.ts"
git commit -m "feat: [US-12 étape 9] — webhook Clerk blocage emails jetables"
```

---

## Task 10 : Vérification finale & build

- [ ] **Étape 1 : TypeScript check complet**

```bash
cd /Users/karide/llm-visibility-tool && npx tsc --noEmit
```

Sortie attendue : aucune erreur.

- [ ] **Étape 2 : Build de production**

```bash
cd /Users/karide/llm-visibility-tool && npm run build
```

Sortie attendue : `✓ Compiled successfully` sans erreur TypeScript ni de build.

- [ ] **Étape 3 : Tests manuels du flux complet**

Démarrer `npm run dev:local`.

**Flux nominal sign-up :**
1. `http://localhost:3000/` → landing page ✓
2. Faire l'onboarding complet → arriver sur le mini-dashboard
3. Cliquer "Voir les recommandations" → redirect `/sign-up` ✓
4. Créer un compte avec un email réel → spinner `/post-sign-up` → atterrissage `/recommendations` ✓

**Protection des routes :**
5. Se déconnecter (localStorage: effacer `llmv_session`)
6. Naviguer `http://localhost:3000/dashboard` → redirect `/sign-in` ✓
7. Naviguer `http://localhost:3000/recommendations` → redirect `/sign-in` ✓

**Email jetable (si webhook configuré en local via ngrok ou tunnel) :**
8. Créer un compte avec `test@mailinator.com` → compte supprimé par le webhook ✓

- [ ] **Étape 4 : Commit final**

```bash
git add -A
git commit -m "feat: [US-12] — authentification Clerk complète + blocage emails jetables"
```

---

## Critères de succès

- [ ] `npm run build` passe sans erreur
- [ ] `/dashboard` et `/recommendations` redirigent vers `/sign-in` si non-authentifié
- [ ] Sign-up nominal → `/post-sign-up` → migration session → `/recommendations`
- [ ] Sign-in → atterrissage `/recommendations`
- [ ] Email jetable (mailinator.com) → compte supprimé via webhook
- [ ] Blocklist Clerk native configurée pour les 15 domaines principaux
