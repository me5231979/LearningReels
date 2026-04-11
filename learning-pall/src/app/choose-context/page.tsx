import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, isAdminRole } from "@/lib/auth";
import { Shield, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChooseContextPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!isAdminRole(user.role)) redirect("/home");

  return (
    <div className="min-h-screen bg-vand-black text-vand-sand flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3 text-vand-gold">
            <Shield size={18} />
            <span className="text-xs font-condensed uppercase tracking-widest">
              {user.role === "super_admin" ? "Super Admin" : "Admin"}
            </span>
          </div>
          <h1 className="text-3xl font-serif mb-2">Welcome back, {user.name}</h1>
          <p className="text-vand-sand/60 text-sm">
            How do you want to work today? You can switch contexts anytime.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/home"
            className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] p-6 hover:border-vand-gold/50 hover:bg-vand-gold/[0.04] transition-all"
          >
            <div className="flex items-center gap-3 mb-4 text-vand-gold">
              <GraduationCap size={28} strokeWidth={1.5} />
              <span className="text-xs font-condensed uppercase tracking-widest text-vand-sand/50">
                Learner
              </span>
            </div>
            <h2 className="text-xl font-serif mb-2">Continue as Learner</h2>
            <p className="text-sm text-vand-sand/60 leading-relaxed">
              Jump into your reels, pick up spaced reviews, and grow your streak.
            </p>
            <div className="mt-6 text-xs font-condensed uppercase tracking-wider text-vand-gold/0 group-hover:text-vand-gold transition-colors">
              Open learner app →
            </div>
          </Link>

          <Link
            href="/admin"
            className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] p-6 hover:border-vand-gold/50 hover:bg-vand-gold/[0.04] transition-all"
          >
            <div className="flex items-center gap-3 mb-4 text-vand-gold">
              <Shield size={28} strokeWidth={1.5} />
              <span className="text-xs font-condensed uppercase tracking-widest text-vand-sand/50">
                Admin
              </span>
            </div>
            <h2 className="text-xl font-serif mb-2">Open Admin Portal</h2>
            <p className="text-sm text-vand-sand/60 leading-relaxed">
              Review reports, manage users, curate reels, and broadcast comms.
            </p>
            <div className="mt-6 text-xs font-condensed uppercase tracking-wider text-vand-gold/0 group-hover:text-vand-gold transition-colors">
              Open admin portal →
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-vand-sand/40 mt-8">
          Tip: once you&rsquo;re in, use the nav to switch between learner and admin views.
        </p>
      </div>
    </div>
  );
}
