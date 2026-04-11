"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password, department }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      if (data.pending) {
        setPendingMessage(data.message);
        setLoading(false);
        return;
      }

      // Auto-login succeeded — send to onboarding
      router.push("/onboarding");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (pendingMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vand-black px-6">
        <div className="w-full max-w-sm text-center">
          <img
            src="/vu-logo-white.png"
            alt="Vanderbilt University"
            className="w-28 mx-auto mb-5"
          />
          <h1 className="font-serif text-2xl font-bold text-white mb-3">
            Awaiting approval
          </h1>
          <p className="text-vand-sand/70 text-sm mb-6">{pendingMessage}</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 rounded bg-vand-gold text-vand-black font-condensed uppercase tracking-wider text-xs font-bold hover:bg-vand-highlight"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vand-black px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/vu-logo-white.png"
            alt="Vanderbilt University"
            className="w-24 mx-auto mb-4"
          />
          <h1 className="font-serif text-2xl font-bold text-white">
            Create your account
          </h1>
          <p className="text-vand-sand/60 text-xs mt-2">
            Learning Reels for Vanderbilt staff
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50"
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50"
              />
            </Field>
          </div>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@vanderbilt.edu"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50"
            />
            <p className="text-[10px] text-vand-sand/40 mt-1">
              Non-@vanderbilt.edu emails require admin approval before access.
            </p>
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50"
            />
          </Field>

          <Field label="Department">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm text-white focus:outline-none focus:border-vand-gold/50"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-condensed uppercase tracking-wider text-sm font-bold bg-vand-gold text-vand-black hover:bg-vand-highlight disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-vand-sand/60 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-vand-gold hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-condensed uppercase tracking-wider text-vand-sand/70 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
