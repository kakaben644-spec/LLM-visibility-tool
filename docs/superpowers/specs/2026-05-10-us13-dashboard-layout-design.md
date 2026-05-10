# US-13 — Layout dashboard authentifié + navigation

**Date :** 2026-05-10
**Statut :** Approuvé
**Stack :** Next.js 16 App Router + Clerk V2 + Tailwind CSS v4 + lucide-react

---

## Objectif

Ajouter un layout persistant avec sidebar de navigation aux pages dashboard authentifiées. La sidebar affiche les 5 sections principales de l'app, le profil utilisateur Clerk en bas, et se replie en drawer sur mobile.

---

## Architecture

### Fichiers créés

```
app/(dashboard)/layout.tsx                    ← Server Component — wrapper global
components/features/dashboard/Sidebar.tsx     ← Client Component — sidebar desktop
components/features/dashboard/MobileNav.tsx   ← Client Component — topbar hamburger + drawer overlay (state co-localisé)
app/(dashboard)/historique/page.tsx           ← Stub "À venir"
app/(dashboard)/recommandations/page.tsx      ← Migration depuis app/recommendations/page.tsx
app/(dashboard)/concurrents/page.tsx          ← Stub "À venir"
app/(dashboard)/parametres/page.tsx           ← Stub "À venir"
```

### Fichiers modifiés

```
app/(dashboard)/dashboard/page.tsx            ← Suppression wrapper min-h-screen/bg
app/recommendations/page.tsx                  ← Supprimé (remplacé par /recommandations)
proxy.ts                                      ← Ajout /recommandations aux routes protégées
.env.local                                    ← NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations
```

---

## Section 1 — Layout Server Component

```tsx
// app/(dashboard)/layout.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/features/dashboard/Sidebar";
import MobileNav from "@/components/features/dashboard/MobileNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const userProps = {
    firstName: user.firstName ?? "",
    email: user.emailAddresses[0]?.emailAddress ?? "",
    imageUrl: user.imageUrl,
  };

  return (
    <div className="flex h-screen bg-[#0F0F1A] overflow-hidden">
      <Sidebar user={userProps} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileNav user={userProps} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Prop `user` partagée** entre `Sidebar` et `MobileNav` pour éviter deux appels `currentUser()`.

---

## Section 2 — Composants sidebar & navigation

### 5 sections (ordre fixe)

| Icône lucide-react | Label | Route |
|---|---|---|
| `LayoutDashboard` | Dashboard | `/dashboard` |
| `History` | Historique | `/historique` |
| `Lightbulb` | Recommandations | `/recommandations` |
| `Users` | Concurrents | `/concurrents` |
| `Settings` | Paramètres | `/parametres` |

### Sidebar.tsx (Client Component)

- **Dimensions :** `w-[220px] flex-shrink-0`, caché sur `< md` (`hidden md:flex`)
- **Fond :** `bg-[#13131f] border-r border-[#1e1e2e]`
- **Logo :** icône violet + "GEO Doctor" en haut
- **Item actif :** `bg-[#6B54FA]/10 text-[#6B54FA] font-semibold`
- **Item inactif :** `text-white/50 hover:text-white hover:bg-white/5`
- **Détection route active :** `usePathname()` — exact match sur la route
- **Bas de sidebar :** `<UserButton />` Clerk + email de l'utilisateur tronqué

### MobileNav.tsx (Client Component)

Regroupe la topbar et le drawer dans un seul composant — le state `isOpen` ne peut pas être lifté dans `layout.tsx` (Server Component), les deux parties doivent donc cohabiter.

**Topbar :**
- Visible uniquement `md:hidden`
- Hauteur 56px, `bg-[#13131f] border-b border-[#1e1e2e]`
- Logo à gauche + bouton hamburger (icône `Menu` lucide) à droite
- `onClick` → `setIsOpen(true)`

**Drawer (rendu inline dans le même composant) :**
- **Overlay :** `fixed inset-0 bg-black/60 z-40` — clic ferme le drawer
- **Panel :** `fixed top-0 left-0 h-full w-[280px] bg-[#13131f] z-50`
- **Animation :** `transform translate-x-[-100%]` → `translate-x-0` via `isOpen` + `transition-transform`
- Mêmes 5 items que Sidebar desktop
- Fermeture : clic overlay **ou** navigation (effet `useEffect` sur `usePathname()`)
- **Pas de librairie externe** — animation CSS pure via classes Tailwind

---

## Section 3 — Pages stub & migration /recommendations

### Pages stub

Structure identique pour `historique`, `concurrents`, `parametres` :

```tsx
export default function [Name]Page() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white">[Titre section]</h1>
      <p className="text-white/50 mt-2">Bientôt disponible.</p>
    </div>
  );
}
```

### Migration /recommendations → /recommandations

1. `app/recommendations/page.tsx` → copié dans `app/(dashboard)/recommandations/page.tsx`
2. `app/recommendations/page.tsx` → supprimé
3. `dashboard/page.tsx` : lien "Voir les recommandations" → `/recommandations`
4. `proxy.ts` : ajouter `/recommandations(.*)` dans `isProtectedRoute`
5. `.env.local` : `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/recommandations`
6. `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` reste `/post-sign-up` (inchangé)
7. `app/api/auth/migrate-session` : la redirection finale reste `/recommendations` → mettre à jour vers `/recommandations`

**Note :** `app/recommendations/page.tsx` était déjà protégée par `proxy.ts`. Après migration, la route `/recommendations` (ancienne) devient 404 — acceptable pour le MVP.

---

## Critères de succès

- [ ] Sidebar visible sur toutes les routes `/(dashboard)/*`
- [ ] Section active mise en évidence selon `usePathname()`
- [ ] `<UserButton />` Clerk fonctionnel en bas (déconnexion native)
- [ ] Drawer mobile fonctionnel (`< md`), fermeture au clic overlay et à la navigation
- [ ] Pages stub accessibles : `/historique`, `/recommandations`, `/concurrents`, `/parametres`
- [ ] `/recommendations` (ancienne) → 404 acceptable
- [ ] `tsc --noEmit` sans erreur
- [ ] `npm run build` propre
