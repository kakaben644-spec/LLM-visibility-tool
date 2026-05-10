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
