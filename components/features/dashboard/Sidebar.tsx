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
