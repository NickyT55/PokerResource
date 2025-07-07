"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [forgotError, setForgotError] = useState("");
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/rooms");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else setShowConfirm(true);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess("");
    setForgotError("");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail);
    setForgotLoading(false);
    if (error) setForgotError(error.message);
    else setForgotSuccess("Check your email for a password reset link.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-2">
      <form className="bg-card p-8 rounded-xl shadow-lg border border-border flex flex-col gap-4 w-full max-w-sm" autoComplete="on" aria-label="Authentication form">
        <h1 className="text-2xl font-bold mb-2 text-center">Poker Tool Login</h1>
        {showForgot ? (
          <>
            <label htmlFor="forgot-email" className="font-semibold">Enter your email to reset password</label>
            <input
              id="forgot-email"
              type="email"
              placeholder="Email"
              className="rounded px-3 py-2 border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
              autoComplete="email"
              aria-label="Email"
              disabled={forgotLoading}
            />
            <button
              className="bg-primary text-primary-foreground font-bold py-2 rounded shadow mt-2 disabled:opacity-50"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              type="submit"
            >
              {forgotLoading ? "Sending..." : "Send Reset Email"}
            </button>
            <button
              className="bg-muted text-muted-foreground font-bold py-2 rounded shadow mt-2"
              type="button"
              onClick={() => setShowForgot(false)}
            >
              Back to Login
            </button>
            {forgotSuccess && <div className="text-green-600 text-center font-bold mt-2">{forgotSuccess}</div>}
            {forgotError && <div className="text-red-600 text-center font-bold mt-2">{forgotError}</div>}
          </>
        ) : showConfirm ? (
          <div className="text-green-600 text-center font-bold py-8" role="status">
            Check your email to confirm your account before signing in.
          </div>
        ) : (
          <>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              className="rounded px-3 py-2 border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-label="Email"
              disabled={loading}
            />
            <label htmlFor="password" className="sr-only">Password</label>
            <div className="relative flex items-center">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="rounded px-3 py-2 border border-border bg-background text-foreground w-full focus:outline-none focus:ring-2 focus:ring-primary"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                aria-label="Password"
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={0}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
              >
                {showPassword ? (
                  <span aria-hidden="true">🙈</span>
                ) : (
                  <span aria-hidden="true">👁️</span>
                )}
              </button>
            </div>
            {error && <div className="text-red-600 text-sm text-center" role="alert">{error}</div>}
            <div className="flex gap-2 mt-2">
              <button
                className="flex-1 bg-primary text-primary-foreground font-bold py-2 rounded shadow disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleSignIn}
                disabled={loading}
                type="submit"
                aria-busy={loading}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                ) : null}
                Sign In
              </button>
              <button
                className="flex-1 bg-accent text-accent-foreground font-bold py-2 rounded shadow disabled:opacity-50 flex items-center justify-center gap-2"
                onClick={handleSignUp}
                disabled={loading}
                type="button"
                aria-busy={loading}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                ) : null}
                Sign Up
              </button>
            </div>
            <button
              className="text-sm text-blue-600 hover:underline mt-2"
              type="button"
              onClick={() => setShowForgot(true)}
            >
              Forgot Password?
            </button>
          </>
        )}
      </form>
    </div>
  );
} 