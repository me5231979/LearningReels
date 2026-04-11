"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setValid(!!d.valid))
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset password.");
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vand-black px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img
            src="/vu-logo-white.png"
            alt="Vanderbilt University"
            className="w-28 mx-auto mb-5"
          />
          <h1 className="font-serif text-3xl font-bold text-white">
            Choose a new password
          </h1>
        </div>

        {checking ? (
          <p className="text-center text-vand-sand/60 text-sm">Verifying link…</p>
        ) : !valid ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-5 py-6 text-center space-y-3">
            <p className="text-red-300 font-bold">Link expired or invalid</p>
            <p className="text-vand-sand/60 text-sm">
              This password reset link is no longer valid. Please request a new
              one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block text-vand-gold text-sm font-medium hover:underline"
            >
              Request new link
            </Link>
          </div>
        ) : done ? (
          <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-6 text-center space-y-3">
            <p className="text-white font-bold">Password updated</p>
            <p className="text-vand-sand/60 text-sm">
              Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-condensed uppercase tracking-wider text-vand-sand/70 mb-1.5"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50 focus:ring-1 focus:ring-vand-gold/30 transition-colors"
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-xs font-condensed uppercase tracking-wider text-vand-sand/70 mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50 focus:ring-1 focus:ring-vand-gold/30 transition-colors"
                placeholder="Re-enter new password"
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-condensed uppercase tracking-wider text-sm font-bold transition-all duration-200 bg-vand-gold text-vand-black hover:bg-vand-highlight disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
