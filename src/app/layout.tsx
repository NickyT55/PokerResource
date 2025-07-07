"use client";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import React, { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/authContext";
import { usePathname, useRouter } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved) setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
  };
  return (
    <button
      className="fixed top-4 right-4 z-50 px-4 py-2 rounded font-bold shadow border-2 border-green-400 bg-blue-700 hover:bg-blue-800 text-yellow-300 hover:text-yellow-200 transition-colors flex items-center gap-2"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      <span className="text-green-400">{theme === "dark" ? "🌞" : "🌙"}</span>
      <span className="font-bold">Theme</span>
    </button>
  );
}

function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };
  return (
    <button
      className="fixed top-4 right-32 z-50 px-4 py-2 rounded bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black font-bold shadow border border-neutral-700 dark:border-neutral-300"
      onClick={toggle}
      aria-label="Toggle fullscreen"
    >
      {isFullscreen ? "⤢ Exit Fullscreen" : "⤢ Fullscreen"}
    </button>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && typeof window !== "undefined" && pathname !== "/auth") {
      router.replace("/auth");
    }
  }, [user, loading, router, pathname]);

  if (pathname === "/auth") return <>{children}</>;
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;
  return <>{children}</>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <AuthGuard>
            <ThemeToggle />
            <FullscreenToggle />
            <SidebarWrapper>
              <main className="flex-1 p-6">{children}</main>
            </SidebarWrapper>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}

function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, setProfile } = useAuth();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);
  const needsProfile = user && !profile;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await setProfile({ first_name: first, last_name: last });
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen">
      {user && <Sidebar />}
      <div className="flex-1 relative">
        {needsProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <form onSubmit={handleSave} className="bg-card border border-border rounded-xl p-8 flex flex-col gap-4 w-full max-w-xs">
              <h2 className="text-xl font-bold mb-2 text-center">Enter Your Name</h2>
              <input
                type="text"
                placeholder="First name"
                className="rounded px-3 py-2 border border-border bg-background text-foreground"
                value={first}
                onChange={e => setFirst(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Last name"
                className="rounded px-3 py-2 border border-border bg-background text-foreground"
                value={last}
                onChange={e => setLast(e.target.value)}
                required
              />
              <button
                className="bg-primary text-primary-foreground font-bold py-2 rounded shadow mt-2"
                type="submit"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
