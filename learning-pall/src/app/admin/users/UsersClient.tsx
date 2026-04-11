"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Shield,
  ShieldOff,
  RotateCcw,
  Trash2,
  UserCheck,
  X,
  Sparkles,
  ChevronDown,
  Loader2,
  MessageCircle,
} from "lucide-react";

type CoachMessage = { role: "user" | "assistant"; content: string; ts: number };
type CoachConversation = {
  id: string;
  reelId: string;
  reelTitle: string;
  topicLabel: string;
  turnsUsed: number;
  createdAt: string;
  updatedAt: string;
  messages: CoachMessage[];
};

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  points: number;
  streak: number;
  lastActiveAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  _count: { progress: number; reactions: number };
};

export default function UsersClient({
  users: initialUsers,
  isSuperAdmin,
  myId,
}: {
  users: AdminUser[];
  isSuperAdmin: boolean;
  myId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (!showDeleted && u.deletedAt) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.jobTitle || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q)
      );
    });
  }, [users, query, showDeleted]);

  async function patchUser(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update user");
        return false;
      }
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function softDelete(id: string) {
    if (!confirm("Soft-delete this user? Their data is preserved but they can no longer sign in.")) return;
    await patchUser(id, { deletedAt: new Date().toISOString() });
  }

  async function restore(id: string) {
    await patchUser(id, { deletedAt: null });
  }

  async function setRole(id: string, role: string) {
    if (!confirm(`Set role to "${role}"?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to update role");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } finally {
      setBusy(null);
    }
  }

  async function resetProgress(id: string) {
    if (!confirm("Reset all progress, bloom levels, and spaced reviews for this user? This cannot be undone.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-progress`, { method: "POST" });
      if (!res.ok) {
        alert("Failed to reset progress");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, _count: { ...u._count, progress: 0 }, points: 0, streak: 0 } : u)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-condensed uppercase tracking-wider text-vand-sand">Users</h1>
          <p className="text-sm text-vand-sand/60 mt-1">{filtered.length} of {users.length}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-2 text-xs text-vand-sand/60">
            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
            Show deleted
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vand-sand/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="bg-white/5 border border-white/10 rounded pl-9 pr-3 py-2 text-sm text-vand-sand placeholder:text-vand-sand/30 focus:outline-none focus:border-vand-gold/50 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className={`bg-white/5 border border-white/10 rounded p-4 ${u.deletedAt ? "opacity-40" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => setEditing(u)} className="text-left flex-1 min-w-0">
                <div className="text-vand-sand text-sm truncate">{u.name}</div>
                <div className="text-[11px] text-vand-sand/40 truncate">{u.email}</div>
              </button>
              <RoleBadge role={u.role} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-vand-sand/60">
              <span>{u._count.progress} reels · {u.points} pts</span>
              <span className="text-vand-sand/40">
                {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
              {isSuperAdmin && u.id !== myId && u.role !== "super_admin" && (
                <button
                  disabled={busy === u.id}
                  onClick={() => setRole(u.id, u.role === "admin" ? "learner" : "admin")}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded border border-white/10 text-vand-sand/70 hover:text-vand-gold hover:bg-white/5"
                >
                  {u.role === "admin" ? <ShieldOff size={12} /> : <Shield size={12} />}
                  {u.role === "admin" ? "Demote" : "Promote"}
                </button>
              )}
              <button
                disabled={busy === u.id || !!u.deletedAt}
                onClick={() => resetProgress(u.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded border border-white/10 text-vand-sand/70 hover:text-vand-sand hover:bg-white/5"
              >
                <RotateCcw size={12} /> Reset
              </button>
              {u.deletedAt ? (
                <button
                  disabled={busy === u.id}
                  onClick={() => restore(u.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded border border-white/10 text-vand-sand/70 hover:text-emerald-400 hover:bg-white/5"
                >
                  <UserCheck size={12} /> Restore
                </button>
              ) : (
                u.id !== myId && u.role !== "super_admin" && (
                  <button
                    disabled={busy === u.id}
                    onClick={() => softDelete(u.id)}
                    className="px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                )
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded p-6 text-center text-sm text-vand-sand/40">
            No users match your search.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white/5 border border-white/10 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-black/40 text-[10px] uppercase tracking-wider text-vand-sand/50">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Progress</th>
              <th className="text-left px-4 py-2">Last seen</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className={`border-t border-white/5 ${u.deletedAt ? "opacity-40" : ""}`}>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(u)} className="text-left">
                    <div className="text-vand-sand hover:text-vand-gold">{u.name}</div>
                    <div className="text-[11px] text-vand-sand/40">{u.email}</div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3 text-vand-sand/70">
                  {u._count.progress} reels · {u.points} pts
                </td>
                <td className="px-4 py-3 text-[11px] text-vand-sand/50">
                  {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {isSuperAdmin && u.id !== myId && u.role !== "super_admin" && (
                      <button
                        title={u.role === "admin" ? "Demote to learner" : "Promote to admin"}
                        disabled={busy === u.id}
                        onClick={() => setRole(u.id, u.role === "admin" ? "learner" : "admin")}
                        className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-vand-gold"
                      >
                        {u.role === "admin" ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </button>
                    )}
                    <button
                      title="Reset progress"
                      disabled={busy === u.id || !!u.deletedAt}
                      onClick={() => resetProgress(u.id)}
                      className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-vand-sand"
                    >
                      <RotateCcw size={14} />
                    </button>
                    {u.deletedAt ? (
                      <button
                        title="Restore"
                        disabled={busy === u.id}
                        onClick={() => restore(u.id)}
                        className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-emerald-400"
                      >
                        <UserCheck size={14} />
                      </button>
                    ) : (
                      u.id !== myId && u.role !== "super_admin" && (
                        <button
                          title="Soft-delete"
                          disabled={busy === u.id}
                          onClick={() => softDelete(u.id)}
                          className="p-1.5 rounded hover:bg-white/10 text-vand-sand/60 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-vand-sand/40">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSave={async (changes) => {
            const ok = await patchUser(editing.id, changes);
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    super_admin: "bg-vand-gold/20 text-vand-gold border-vand-gold/30",
    admin: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    learner: "bg-white/5 text-vand-sand/60 border-white/10",
  };
  const label = role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border font-condensed ${map[role] || map.learner}`}>
      {label}
    </span>
  );
}

function EditUserModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [jobTitle, setJobTitle] = useState(user.jobTitle || "");
  const [department, setDepartment] = useState(user.department || "");

  const [coach, setCoach] = useState<CoachConversation[] | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [openCoachId, setOpenCoachId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCoachLoading(true);
    setCoachError(null);
    fetch(`/api/admin/users/${user.id}/coach-history`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load coach history");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setCoach(data.conversations || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setCoachError(e.message || "Load failed");
      })
      .finally(() => {
        if (!cancelled) setCoachLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-vand-black border border-white/10 rounded max-w-md w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-condensed uppercase tracking-wider text-vand-sand">Edit User</h2>
          <button onClick={onClose} className="text-vand-sand/40 hover:text-vand-sand"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
          <Field label="Department" value={department} onChange={setDepartment} />
        </div>

        {/* Coaching History */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <h3 className="text-[10px] uppercase tracking-wider text-vand-sand/50 mb-3 font-condensed">
            Coaching History
          </h3>
          {coachLoading && (
            <div className="flex items-center gap-2 text-vand-sand/50 text-xs py-2">
              <Loader2 size={12} className="animate-spin" />
              Loading conversations…
            </div>
          )}
          {coachError && (
            <div className="text-xs text-red-400/80 py-2">{coachError}</div>
          )}
          {!coachLoading && !coachError && coach && coach.length === 0 && (
            <div className="bg-white/5 border border-white/10 border-dashed rounded px-3 py-4 text-center">
              <MessageCircle className="w-4 h-4 text-vand-sand/40 mx-auto mb-1.5" />
              <p className="text-vand-sand/50 text-[11px]">
                No coaching sessions yet for this user.
              </p>
            </div>
          )}
          {!coachLoading && !coachError && coach && coach.length > 0 && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {coach.map((c) => {
                const open = openCoachId === c.id;
                return (
                  <div
                    key={c.id}
                    className="bg-white/5 border border-white/10 rounded overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenCoachId(open ? null : c.id)}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white/5"
                    >
                      <Sparkles size={11} className="text-vand-gold mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-vand-sand font-bold leading-snug break-words">
                          {c.reelTitle}
                        </p>
                        <p className="text-[10px] text-vand-sand/40 mt-0.5 font-condensed uppercase tracking-wider">
                          {c.topicLabel} · {c.turnsUsed}{" "}
                          {c.turnsUsed === 1 ? "turn" : "turns"} ·{" "}
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronDown
                        size={12}
                        className={`text-vand-sand/40 shrink-0 mt-1 transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && (
                      <div className="border-t border-white/5 bg-black/40 px-3 py-2 space-y-1.5">
                        {c.messages.length === 0 ? (
                          <p className="text-vand-sand/40 text-[11px] text-center py-2">
                            No replies from learner yet.
                          </p>
                        ) : (
                          c.messages.map((m, i) => (
                            <div
                              key={i}
                              className={
                                m.role === "user"
                                  ? "flex justify-end"
                                  : "flex justify-start"
                              }
                            >
                              <div
                                className={
                                  m.role === "user"
                                    ? "bg-vand-gold/20 border border-vand-gold/30 rounded px-2 py-1.5 text-[11px] text-vand-sand max-w-[85%] whitespace-pre-wrap"
                                    : "bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-vand-sand/80 max-w-[85%] whitespace-pre-wrap"
                                }
                              >
                                {m.content}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-vand-sand/60 hover:text-vand-sand">Cancel</button>
          <button
            onClick={() => onSave({ name, email, jobTitle, department })}
            className="px-4 py-2 text-sm bg-vand-gold text-vand-black rounded font-semibold hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-vand-sand/50 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-vand-sand focus:outline-none focus:border-vand-gold/50"
      />
    </label>
  );
}
