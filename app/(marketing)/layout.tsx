import type { ReactNode } from "react";
import { Sora, DM_Sans } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${sora.variable} ${dmSans.variable} font-[family-name:var(--font-dm-sans)]`}>
      {children}
    </div>
  );
}
