"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Play, Compass, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/reels", label: "Reels", icon: Play },
  { href: "/onboarding", label: "Explore", icon: Compass },
  { href: "/profile", label: "Profile", icon: User },
];

export default function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col bg-vand-black" style={{ height: "100dvh" }}>
      {/* Main content area — fills available space */}
      <main className="flex-1 overflow-hidden min-h-0 pb-16">
        {children}
      </main>

      {/* Bottom navigation — always visible so users can exit back to Home */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-vand-black/95 backdrop-blur-sm border-t border-white/5">
        <div className="flex items-center justify-around h-16 max-w-md mx-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${
                  active
                    ? "text-vand-gold"
                    : "text-vand-sand/40 hover:text-vand-sand/70"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-condensed uppercase tracking-wider">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
