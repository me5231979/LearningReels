"use client";

import { useEffect, useState } from "react";
import { UserCheck, UserX, Loader2, Mail } from "lucide-react";

type PendingUser = {
  id: string;
  email: string;
  name: string;
  department: string | null;
  createdAt: string;
};

export default function ApprovalsClient() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/approvals", { cache: "no-store" });
      const d = await r.json();
      setUsers(d.users || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "approve" | "deny") {
    if (action === "deny" && !confirm("Deny this signup? The user will not be able to log in.")) {
      return;
    }
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } else {
        const d = await r.json().catch(() => ({}));
        alert(d.error || "Failed");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand flex items-center gap-2">
          <UserCheck size={22} className="text-vand-gold" /> Signup Approvals
        </h1>
        <p className="text-sm text-vand-sand/60 mt-1">
          Signups with non-@vanderbilt.edu email addresses need admin review before
          they can sign in.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-vand-gold" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center text-sm text-vand-sand/40 py-12 border border-dashed border-white/10 rounded">
          No pending signups.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-vand-sand font-medium">{u.name}</div>
                <div className="text-xs text-vand-sand/60 flex items-center gap-1.5 mt-0.5">
                  <Mail size={11} /> {u.email}
                </div>
                {u.department && (
                  <div className="text-[11px] text-vand-gold/70 mt-1">
                    {u.department}
                  </div>
                )}
                <div className="text-[10px] text-vand-sand/40 mt-1">
                  Submitted {new Date(u.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={busy === u.id}
                  onClick={() => decide(u.id, "approve")}
                  className="inline-flex items-center gap-1.5 bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-xs font-bold px-3 py-2 rounded hover:bg-vand-highlight disabled:opacity-50"
                >
                  <UserCheck size={13} /> Approve
                </button>
                <button
                  disabled={busy === u.id}
                  onClick={() => decide(u.id, "deny")}
                  className="inline-flex items-center gap-1.5 border border-red-500/40 text-red-400 font-condensed uppercase tracking-wider text-xs font-bold px-3 py-2 rounded hover:bg-red-500/10 disabled:opacity-50"
                >
                  <UserX size={13} /> Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
