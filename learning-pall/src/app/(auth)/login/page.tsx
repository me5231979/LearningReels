"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Redirect based on onboarding status
      if (!data.user.onboardedAt && data.user.role === "learner") {
        router.push("/onboarding");
      } else {
        router.push("/home");
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-vand-black px-6">
      <div className="w-full max-w-sm">
        {/* Vanderbilt Logo */}
        <div className="text-center mb-10">
          <img
            src="/vu-logo-white.png"
            alt="Vanderbilt University"
            className="w-28 mx-auto mb-5"
          />
          <h1 className="font-serif text-3xl font-bold text-white">
            Learning Reels
          </h1>
          <p className="text-vand-sand/60 text-sm mt-2">
            Professional development, reimagined.
          </p>
        </div>

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

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-condensed uppercase tracking-wider text-vand-sand/70 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-vand-gold/50 focus:ring-1 focus:ring-vand-gold/30 transition-colors"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-condensed uppercase tracking-wider text-sm font-bold transition-all duration-200 bg-vand-gold text-vand-black hover:bg-vand-highlight disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-vand-sand/60 hover:text-vand-gold text-xs font-condensed uppercase tracking-wider"
            >
              Forgot your password?
            </Link>
          </div>
        </form>

        <p className="text-center text-vand-sand/60 text-sm mt-6">
          New here?{" "}
          <Link href="/signup" className="text-vand-gold hover:underline font-medium">
            Create an account
          </Link>
        </p>

        <p className="text-center text-vand-sand/40 text-xs mt-8">
          Vanderbilt University
        </p>
      </div>
    </div>
  );
}
