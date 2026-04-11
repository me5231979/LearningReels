"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Film,
  Flag,
  Sparkles,
  Megaphone,
  LogOut,
  Shield,
  Menu,
  X,
} from "lucide-react";

type Props = {
  user: { id: string; email: string; name: string; role: "admin" | "super_admin" };
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: "reports" | "approvals";
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/approvals", label: "Approvals", icon: UserCheck, badge: "approvals" },
  { href: "/admin/reels", label: "Reels", icon: Film },
  { href: "/admin/reports", label: "Reports", icon: Flag, badge: "reports" },
  { href: "/admin/generate", label: "Generate", icon: Sparkles },
  { href: "/admin/comms", label: "Generate Comms", icon: Megaphone },
];

export default function AdminShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [openCount, setOpenCount] = useState<number>(0);
  const [approvalCount, setApprovalCount] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSuperAdmin = user.role === "super_admin";

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        if (isSuperAdmin) {
          const res = await fetch("/api/admin/notifications/count", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setOpenCount(data.count ?? 0);
          }
        }
        const aRes = await fetch("/api/admin/approvals/count", { cache: "no-store" });
        if (aRes.ok) {
          const aData = await aRes.json();
          if (!cancelled) setApprovalCount(aData.count ?? 0);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isSuperAdmin]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="text-vand-gold shrink-0" size={20} />
          <div className="min-w-0">
            <div className="text-vand-gold font-condensed text-sm uppercase tracking-wider truncate">
              Admin Portal
            </div>
            <div className="text-xs text-vand-sand/50 truncate">Vanderbilt Learning Reels</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 text-vand-sand/60 hover:text-vand-sand"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const badgeCount =
            badge === "reports"
              ? isSuperAdmin
                ? openCount
                : 0
              : badge === "approvals"
              ? approvalCount
              : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-sans transition-colors ${
                active
                  ? "bg-vand-gold/15 text-vand-gold border-l-2 border-vand-gold"
                  : "text-vand-sand/70 hover:bg-white/5 hover:text-vand-sand"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span className="bg-vand-gold text-vand-black text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3 space-y-2">
        <Link
          href="/home"
          className="flex items-center gap-3 px-3 py-2 rounded text-xs text-vand-sand/60 hover:text-vand-sand hover:bg-white/5"
        >
          ← Back to learner app
        </Link>
        <div className="px-3 py-2">
          <div className="text-xs text-vand-sand/80 truncate">{user.name}</div>
          <div className="text-[10px] text-vand-sand/40 truncate">{user.email}</div>
          <div className="text-[10px] text-vand-gold uppercase tracking-wider mt-1">
            {user.role === "super_admin" ? "Super Admin" : "Admin"}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-xs text-vand-sand/60 hover:text-vand-sand hover:bg-white/5"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-vand-black text-vand-sand lg:flex">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-vand-black/95 backdrop-blur border-b border-white/10">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 text-vand-sand"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="text-vand-gold shrink-0" size={16} />
          <span className="text-vand-gold font-condensed text-xs uppercase tracking-wider truncate">
            Admin Portal
          </span>
          {(() => {
            const total = (isSuperAdmin ? openCount : 0) + approvalCount;
            return total > 0 ? (
              <span className="bg-vand-gold text-vand-black text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {total}
              </span>
            ) : null;
          })()}
        </div>
        <div className="w-7" />
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — drawer on mobile, fixed column on desktop */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-white/10 bg-black/95 lg:bg-black/40 flex flex-col transform transition-transform duration-200 lg:transform-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-hidden lg:overflow-y-auto">{children}</main>
    </div>
  );
}
