"use client";
import { useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const { user, profile, setProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await setProfile({ first_name: firstName, last_name: lastName });
      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw new Error(emailError.message);
      }
      setSuccess("Profile updated!");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-md mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4 bg-card border border-border rounded-xl p-6 shadow">
        <label className="font-semibold">First Name</label>
        <input
          type="text"
          className="rounded px-3 py-2 border border-border bg-background text-foreground"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
        />
        <label className="font-semibold">Last Name</label>
        <input
          type="text"
          className="rounded px-3 py-2 border border-border bg-background text-foreground"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
        />
        <label className="font-semibold">Email</label>
        <input
          type="email"
          className="rounded px-3 py-2 border border-border bg-background text-foreground"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground font-bold py-2 rounded shadow mt-2 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {success && <div className="text-green-600 text-center font-bold">{success}</div>}
        {error && <div className="text-red-600 text-center font-bold">{error}</div>}
      </form>
    </div>
  );
} 