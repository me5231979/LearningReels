"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
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
            Reset password
          </h1>
          <p className="text-vand-sand/60 text-sm mt-2">
            We&rsquo;ll email you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-6 text-center space-y-3">
            <p className="text-white font-bold">Check your email</p>
            <p className="text-vand-sand/60 text-sm">
              If an account exists for{" "}
              <span className="text-vand-gold">{email}</span>, a password reset
              link is on its way. The link expires in 30 minutes.
            </p>
            <p className="text-vand-sand/40 text-xs">
              Didn&rsquo;t get it? Check your spam folder or try again.
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
                htmlFor="email"
                className="block text-xs font-condensed uppercase tracking-wider text-vand-sand/70 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50 focus:ring-1 focus:ring-vand-gold/30 transition-colors"
                placeholder="you@vanderbilt.edu"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-condensed uppercase tracking-wider text-sm font-bold transition-all duration-200 bg-vand-gold text-vand-black hover:bg-vand-highlight disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-vand-sand/60 text-sm mt-6">
          Remembered it?{" "}
          <Link href="/login" className="text-vand-gold hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
