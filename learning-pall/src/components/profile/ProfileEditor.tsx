"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building,
  Check,
  Lock,
  Loader2,
  Mail,
  User as UserIcon,
  Briefcase,
  X,
} from "lucide-react";
import { DEPARTMENTS } from "@/lib/departments";

type Mode = "view" | "details" | "password";

type InitialUser = {
  name: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
};

export default function ProfileEditor({
  initialUser,
}: {
  initialUser: InitialUser;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [user, setUser] = useState(initialUser);

  // details form state
  const [name, setName] = useState(initialUser.name);
  const [email, setEmail] = useState(initialUser.email);
  const [jobTitle, setJobTitle] = useState(initialUser.jobTitle || "");
  const [department, setDepartment] = useState(initialUser.department || "");
  const [currentPassword, setCurrentPassword] = useState("");

  // password form state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function resetDetailsForm() {
    setName(user.name);
    setEmail(user.email);
    setJobTitle(user.jobTitle || "");
    setDepartment(user.department || "");
    setCurrentPassword("");
    setError(null);
  }

  function resetPasswordForm() {
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setError(null);
  }

  async function saveDetails() {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() !== user.name) body.name = name.trim();
      if (email.trim().toLowerCase() !== user.email) body.email = email.trim();
      if ((jobTitle || "").trim() !== (user.jobTitle || ""))
        body.jobTitle = jobTitle.trim();
      if (department !== (user.department || "")) body.department = department;

      if (Object.keys(body).length === 0) {
        setMode("view");
        return;
      }

      // Email change requires current password
      if (body.email) {
        if (!currentPassword) {
          setError("Enter your current password to change your email.");
          return;
        }
        body.currentPassword = currentPassword;
      }

      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Failed to update");
        return;
      }
      setUser({
        name: d.user.name,
        email: d.user.email,
        jobTitle: d.user.jobTitle,
        department: d.user.department,
      });
      setMode("view");
      setFlash("Profile updated.");
      setCurrentPassword("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setError(null);
    if (pwNew.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Failed to update password");
        return;
      }
      resetPasswordForm();
      setMode("view");
      setFlash("Password updated.");
    } finally {
      setSaving(false);
    }
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 3);

  // ─── View mode ───────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="space-y-3">
        {flash && (
          <div className="bg-vand-gold/10 border border-vand-gold/30 text-vand-gold text-xs font-condensed uppercase tracking-wider px-3 py-2 rounded flex items-center justify-between">
            <span>{flash}</span>
            <button
              type="button"
              onClick={() => setFlash(null)}
              className="text-vand-gold/70 hover:text-vand-gold"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Account details summary card */}
        <button
          type="button"
          onClick={() => {
            resetDetailsForm();
            setMode("details");
          }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-left active:bg-white/10 transition-colors"
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-condensed uppercase tracking-wider text-vand-sand/50">
              <UserIcon size={11} />
              Account
            </div>
            <span className="text-[10px] text-vand-gold/70 font-condensed uppercase tracking-wider shrink-0">
              Edit
            </span>
          </div>
          <div className="space-y-1.5">
            <Row icon={<UserIcon size={12} />} label="Name" value={user.name} />
            <Row icon={<Mail size={12} />} label="Email" value={user.email} />
            <Row
              icon={<Briefcase size={12} />}
              label="Job title"
              value={user.jobTitle || "Not set"}
              muted={!user.jobTitle}
            />
            <Row
              icon={<Building size={12} />}
              label="Department"
              value={user.department || "Not set"}
              muted={!user.department}
            />
          </div>
        </button>

        {/* Password card */}
        <button
          type="button"
          onClick={() => {
            resetPasswordForm();
            setMode("password");
          }}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-left active:bg-white/10 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-condensed uppercase tracking-wider text-vand-sand/50 mb-1">
                <Lock size={11} />
                Password
              </div>
              <p className="text-sm text-white font-medium">
                Change your password
              </p>
            </div>
            <span className="text-[10px] text-vand-gold/70 font-condensed uppercase tracking-wider shrink-0">
              Update
            </span>
          </div>
        </button>

        {/* hidden initials helper to silence unused-var lint if needed */}
        <span className="sr-only">{initials}</span>
      </div>
    );
  }

  // ─── Details edit mode ───────────────────────────────────
  if (mode === "details") {
    const emailChanged = email.trim().toLowerCase() !== user.email;
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3 text-vand-sand/70 text-xs font-condensed uppercase tracking-wider">
          <UserIcon size={14} className="text-vand-gold" />
          Edit account
        </div>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className="profile-input"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            autoComplete="email"
            className="profile-input"
          />
        </Field>

        <Field label="Job title">
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={saving}
            placeholder="Optional"
            className="profile-input"
          />
        </Field>

        <Field label="Department">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={saving}
            className="profile-input"
          >
            <option value="" className="bg-vand-black">
              Select your department…
            </option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d} className="bg-vand-black">
                {d}
              </option>
            ))}
          </select>
        </Field>

        {emailChanged && (
          <Field label="Current password (required to change email)">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={saving}
              autoComplete="current-password"
              className="profile-input"
            />
          </Field>
        )}

        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={saveDetails}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-xs font-bold px-3 py-1.5 rounded hover:bg-vand-highlight disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              resetDetailsForm();
              setMode("view");
            }}
            disabled={saving}
            className="text-vand-sand/60 text-xs px-3 py-1.5"
          >
            Cancel
          </button>
        </div>

        <style jsx>{`
          .profile-input {
            width: 100%;
            background: var(--color-vand-black, #1c1c1c);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 14px;
            color: var(--color-vand-sand, #f5e9d3);
          }
          .profile-input:focus {
            outline: none;
            border-color: rgba(207, 174, 112, 0.6);
          }
        `}</style>
      </div>
    );
  }

  // ─── Password edit mode ──────────────────────────────────
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 text-vand-sand/70 text-xs font-condensed uppercase tracking-wider">
        <Lock size={14} className="text-vand-gold" />
        Change password
      </div>

      <Field label="Current password">
        <input
          type="password"
          value={pwCurrent}
          onChange={(e) => setPwCurrent(e.target.value)}
          disabled={saving}
          autoComplete="current-password"
          className="profile-input"
        />
      </Field>

      <Field label="New password (8+ characters)">
        <input
          type="password"
          value={pwNew}
          onChange={(e) => setPwNew(e.target.value)}
          disabled={saving}
          autoComplete="new-password"
          className="profile-input"
        />
      </Field>

      <Field label="Confirm new password">
        <input
          type="password"
          value={pwConfirm}
          onChange={(e) => setPwConfirm(e.target.value)}
          disabled={saving}
          autoComplete="new-password"
          className="profile-input"
        />
      </Field>

      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={savePassword}
          disabled={saving || !pwCurrent || !pwNew || !pwConfirm}
          className="inline-flex items-center gap-1.5 bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-xs font-bold px-3 py-1.5 rounded hover:bg-vand-highlight disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Update password
        </button>
        <button
          type="button"
          onClick={() => {
            resetPasswordForm();
            setMode("view");
          }}
          disabled={saving}
          className="text-vand-sand/60 text-xs px-3 py-1.5"
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .profile-input {
          width: 100%;
          background: var(--color-vand-black, #1c1c1c);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 14px;
          color: var(--color-vand-sand, #f5e9d3);
        }
        .profile-input:focus {
          outline: none;
          border-color: rgba(207, 174, 112, 0.6);
        }
      `}</style>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-vand-sand/40 shrink-0">{icon}</span>
      <span className="text-vand-sand/40 text-[11px] font-condensed uppercase tracking-wider w-20 shrink-0">
        {label}
      </span>
      <span
        className={`truncate font-medium ${muted ? "text-vand-sand/40" : "text-white"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-condensed uppercase tracking-wider text-vand-sand/60 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
