# US-13 Dashboard Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent sidebar layout to all authenticated dashboard pages, with 5 nav sections, Clerk UserButton, and a mobile drawer.

**Architecture:** A Server Component layout (`app/(dashboard)/layout.tsx`) calls `currentUser()` once and passes a `userProps` object to two Client Components — `Sidebar.tsx` (desktop) and `MobileNav.tsx` (mobile topbar + drawer). Pages under `/(dashboard)/` inherit this layout automatically. The existing `/recommendations` route is migrated to `/recommandations` (French) and protected.

**Tech Stack:** Next.js 16 App Router, @clerk/nextjs v7.3.3, Tailwind CSS v4, lucide-react

---

## File Map

| Status | Path | Role |
|--------|------|------|
| Create | `components/features/dashboard/Sidebar.tsx` | Desktop sidebar (Client Component) |
| Create | `components/features/dashboard/MobileNav.tsx` | Mobile topbar + drawer (Client Component) |
| Create | `app/(dashboard)/layout.tsx` | Auth guard + layout shell (Server Component) |
| Modify | `app/(dashboard)/dashboard/page.tsx` | Remove `min-h-screen bg-[#0F0F1A]` wrapper; update recommendation link |
| Create | `app/(dashboard)/historique/page.tsx` | Stub "Bientôt disponible" |
| Create | `app/(dashboard)/concurrents/page.tsx` | Stub "Bientôt disponible" |
| Create | `app/(dashboard)/parametres/page.tsx` | Stub "Bientôt disponible" |
| Create | `app/(dashboard)/recommandations/page.tsx` | Migrated from `app/recommendations/page.tsx` |
| Delete | `app/recommendations/page.tsx` | Replaced by `/recommandations` |
| Modify | `proxy.ts` | Add `/recommandations(.*)` to protected routes |
| Modify | `app/(auth)/post-sign-up/page.tsx` | Update redirect `/recommendations` → `/recommandations` |
| Modify | `.env.example` | Update `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` |

> **Manual step (not automatable):** In `.env.local`, change `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations` to `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations`.

---

## Task 1: Sidebar.tsx — Desktop sidebar Client Component

**Files:**
- Create: `components/features/dashboard/Sidebar.tsx`

**Context:** This project uses Tailwind CSS v4. Arbitrary color values like `bg-[#6B54FA]` are supported. The purple accent is `#6B54FA`. `lucide-react` is already installed. `@clerk/nextjs` v7.3.3 provides `<UserButton />` which handles sign-out natively.

- [ ] **Step 1: Create the file**

```tsx
// components/features/dashboard/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  History,
  Lightbulb,
  Users,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface UserProps {
  firstName: string;
  email: string;
  imageUrl: string;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: History, label: "Historique", href: "/historique" },
  { icon: Lightbulb, label: "Recommandations", href: "/recommandations" },
  { icon: Users, label: "Concurrents", href: "/concurrents" },
  { icon: Settings, label: "Paramètres", href: "/parametres" },
] as const;

export default function Sidebar({ user }: { user: UserProps }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col bg-[#13131f] border-r border-[#1e1e2e]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="w-6 h-6 rounded-md bg-[#6B54FA] flex-shrink-0" />
        <span className="font-bold text-white text-sm tracking-wide">
          GEO Doctor
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[#6B54FA]/10 text-[#6B54FA] font-semibold"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[#1e1e2e] px-4 py-4 flex items-center gap-2.5">
        <UserButton />
        <span className="text-xs text-white/50 truncate max-w-[130px]">
          {user.email}
        </span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/dashboard/Sidebar.tsx
git commit -m "feat: [US-13 step 1] — Sidebar desktop Client Component"
```

---

## Task 2: MobileNav.tsx — Mobile topbar + drawer Client Component

**Files:**
- Create: `components/features/dashboard/MobileNav.tsx`

**Context:** The topbar (`md:hidden`) and the drawer must share `isOpen` state. They cannot be split into separate components because their parent (`layout.tsx`) is a Server Component that cannot hold React state. Both live in `MobileNav.tsx`. The drawer closes automatically when `pathname` changes (navigation) via `useEffect`.

- [ ] **Step 1: Create the file**

```tsx
// components/features/dashboard/MobileNav.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  History,
  Lightbulb,
  Users,
  Settings,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

interface UserProps {
  firstName: string;
  email: string;
  imageUrl: string;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: History, label: "Historique", href: "/historique" },
  { icon: Lightbulb, label: "Recommandations", href: "/recommandations" },
  { icon: Users, label: "Concurrents", href: "/concurrents" },
  { icon: Settings, label: "Paramètres", href: "/parametres" },
] as const;

export default function MobileNav({ user }: { user: UserProps }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Topbar — hidden on md+ */}
      <header className="md:hidden flex items-center justify-between h-14 px-4 bg-[#13131f] border-b border-[#1e1e2e] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#6B54FA] flex-shrink-0" />
          <span className="font-bold text-white text-sm">GEO Doctor</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="text-white/60 hover:text-white p-1"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Drawer — only rendered when open */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40" aria-modal="true">
          {/* Overlay — click closes drawer */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute top-0 left-0 h-full w-[280px] bg-[#13131f] z-50 flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e1e2e]">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#6B54FA] flex-shrink-0" />
                <span className="font-bold text-white text-sm">GEO Doctor</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1"
                aria-label="Fermer le menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 space-y-0.5">
              {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? "bg-[#6B54FA]/10 text-[#6B54FA] font-semibold"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="border-t border-[#1e1e2e] px-4 py-4 flex items-center gap-2.5">
              <UserButton />
              <span className="text-xs text-white/50 truncate max-w-[190px]">
                {user.email}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/features/dashboard/MobileNav.tsx
git commit -m "feat: [US-13 step 2] — MobileNav topbar + drawer Client Component"
```

---

## Task 3: Layout Server Component

**Files:**
- Create: `app/(dashboard)/layout.tsx`

**Context:** `currentUser()` is from `@clerk/nextjs/server` — async, must be awaited. The `(dashboard)` route group means this layout applies automatically to `/dashboard`, `/historique`, `/recommandations`, `/concurrents`, `/parametres` without affecting the URL. The primary email is retrieved via `primaryEmailAddressId` to avoid returning a non-primary address.

- [ ] **Step 1: Create the file**

```tsx
// app/(dashboard)/layout.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/features/dashboard/Sidebar";
import MobileNav from "@/components/features/dashboard/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";

  const userProps = {
    firstName: user.firstName ?? "",
    email: primaryEmail,
    imageUrl: user.imageUrl,
  };

  return (
    <div className="flex h-screen bg-[#0F0F1A] overflow-hidden">
      <Sidebar user={userProps} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav user={userProps} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/layout.tsx
git commit -m "feat: [US-13 step 3] — layout Server Component avec auth guard"
```

---

## Task 4: Strip dashboard page wrapper + update recommendation link

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Context:** The layout now provides `bg-[#0F0F1A]`, `min-h-screen`, and `overflow-y-auto`. Duplicating these on the page causes visual bugs (double scroll). The "Voir les recommandations" button currently routes to `/sign-up` — users are now authenticated, so it should route directly to `/recommandations`.

Three edits needed:

1. Loading state: remove `bg-[#0F0F1A]` and `h-screen` from the spinner wrapper
2. Error state: remove `bg-[#0F0F1A]` and `h-screen` from the error wrapper
3. Root render: replace `<div className="min-h-screen bg-[#0F0F1A] text-white">` with `<div className="text-white">`
4. Recommendation button: change `router.push("/sign-up")` to `router.push("/recommandations")`

- [ ] **Step 1: Update loading state (line ~188)**

Find:
```tsx
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
```

Replace with:
```tsx
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
```

- [ ] **Step 2: Update error state (line ~194)**

Find:
```tsx
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0F0F1A] text-white">
```

Replace with:
```tsx
      <div className="flex h-full flex-col items-center justify-center gap-4 text-white">
```

- [ ] **Step 3: Update root wrapper (line ~209)**

Find:
```tsx
    <div className="min-h-screen bg-[#0F0F1A] text-white">
```

Replace with:
```tsx
    <div className="text-white">
```

- [ ] **Step 4: Update recommendation button (line ~385)**

Find:
```tsx
          <Button onClick={() => router.push("/sign-up")}>
            Voir les recommandations
          </Button>
```

Replace with:
```tsx
          <Button onClick={() => router.push("/recommandations")}>
            Voir les recommandations
          </Button>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: [US-13 step 4] — strip dashboard page wrapper, update reco link"
```

---

## Task 5: Stub pages — historique, concurrents, parametres

**Files:**
- Create: `app/(dashboard)/historique/page.tsx`
- Create: `app/(dashboard)/concurrents/page.tsx`
- Create: `app/(dashboard)/parametres/page.tsx`

**Context:** These are placeholder pages. They inherit the dashboard layout automatically. No client-side code needed — pure Server Components.

- [ ] **Step 1: Create `app/(dashboard)/historique/page.tsx`**

```tsx
// app/(dashboard)/historique/page.tsx
export default function HistoriquePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">Historique</h1>
      <p className="text-white/50 mt-2">Bientôt disponible.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/concurrents/page.tsx`**

```tsx
// app/(dashboard)/concurrents/page.tsx
export default function ConcurrentsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">Concurrents</h1>
      <p className="text-white/50 mt-2">Bientôt disponible.</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/(dashboard)/parametres/page.tsx`**

```tsx
// app/(dashboard)/parametres/page.tsx
export default function ParametresPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">Paramètres</h1>
      <p className="text-white/50 mt-2">Bientôt disponible.</p>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/historique/page.tsx app/\(dashboard\)/concurrents/page.tsx app/\(dashboard\)/parametres/page.tsx
git commit -m "feat: [US-13 step 5] — pages stub historique, concurrents, parametres"
```

---

## Task 6: Migrate /recommendations → /recommandations

**Files:**
- Create: `app/(dashboard)/recommandations/page.tsx` (copy of `app/recommendations/page.tsx`)
- Delete: `app/recommendations/page.tsx`
- Modify: `proxy.ts`
- Modify: `app/(auth)/post-sign-up/page.tsx`
- Modify: `.env.example`

**Context:** The existing `app/recommendations/page.tsx` is a standalone page (no layout). Moving it inside `/(dashboard)/recommandations/` gives it the sidebar automatically. The old route becomes 404 — acceptable. `proxy.ts` must protect the new route. `post-sign-up` redirects to `/recommendations` after migration — update to `/recommandations`. `.env.example` documents the updated sign-in redirect.

> **Manual step for the implementer:** Also update `.env.local` (not committed) — change `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations` to `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations`.

- [ ] **Step 1: Read the full content of `app/recommendations/page.tsx`** and copy it verbatim to `app/(dashboard)/recommandations/page.tsx` (no changes to the content needed — the layout is inherited from the route group).

- [ ] **Step 2: Delete `app/recommendations/page.tsx`**

```bash
rm app/recommendations/page.tsx
```

- [ ] **Step 3: Update `proxy.ts`**

Find:
```ts
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/recommendations(.*)",
]);
```

Replace with:
```ts
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/recommandations(.*)",
]);
```

- [ ] **Step 4: Update `app/(auth)/post-sign-up/page.tsx`**

Find:
```ts
      router.replace("/recommendations");
```

Replace with:
```ts
      router.replace("/recommandations");
```

- [ ] **Step 5: Update `.env.example`**

Find:
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations
```

Replace with:
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations
```

- [ ] **Step 6: Update `.env.local` (manual — not committed)**

In `.env.local`, change:
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommendations
```
to:
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/\(dashboard\)/recommandations/page.tsx proxy.ts app/\(auth\)/post-sign-up/page.tsx .env.example
git commit -m "feat: [US-13 step 6] — migration /recommendations → /recommandations"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Start dev server: `npm run dev:local`
- [ ] Navigate to `/dashboard` — sidebar visible on desktop, `UserButton` in bottom-left
- [ ] Navigate between all 5 routes — active item highlighted correctly
- [ ] Resize to < 768px — sidebar hidden, topbar with hamburger visible
- [ ] Open drawer on mobile — overlay closes it, navigation closes it
- [ ] `/historique`, `/concurrents`, `/parametres` → stub page renders inside sidebar layout
- [ ] `/recommandations` → recommendations page renders inside sidebar layout
- [ ] `/recommendations` (old) → 404
- [ ] Sign out via `UserButton` → redirected to sign-in
