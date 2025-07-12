"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface SessionSettingsFormProps {
  sessionId: string;
  initialSettings: any;
  isAdmin: boolean;
}

const defaultSettings = {
  defaultBlindDuration: 900,
  startingChips: 10000,
  buyInAmount: 100,
  payoutsCount: 3,
};

export default function SessionSettingsForm({ sessionId, initialSettings, isAdmin }: SessionSettingsFormProps) {
  const [form, setForm] = useState<any>(initialSettings || defaultSettings);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tournamentLength, setTournamentLength] = useState(120); // default 2 hours

  useEffect(() => {
    setForm(initialSettings || defaultSettings);
    if (initialSettings?.tournamentLength) setTournamentLength(initialSettings.tournamentLength);
  }, [initialSettings]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // Blind level auto-generation based on desired tournament length
  const handleGenerateBlindLevels = () => {
    const numLevels = Math.ceil((tournamentLength * 60) / form.defaultBlindDuration);
    let small = 50;
    let big = 100;
    const levels: any[] = [];
    for (let i = 0; i < numLevels; i++) {
      levels.push({
        id: `${i + 1}`,
        smallBlind: small,
        bigBlind: big,
        duration: form.defaultBlindDuration,
      });
      // Simple blind progression: double every 2 levels, always round to nearest 50
      if ((i + 1) % 2 === 0) {
        small = Math.round(small * 2 / 50) * 50;
        big = Math.round(big * 2 / 50) * 50;
      } else {
        small = Math.round(small * 1.5 / 50) * 50;
        big = Math.round(big * 1.5 / 50) * 50;
      }
    }
    setForm((prev: any) => ({ ...prev, blindLevels: levels }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from("sessions")
        .update({ settings: form })
        .eq("id", sessionId);

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Settings saved successfully!");
      }
    } catch (err) {
      setError("Failed to save settings");
    }

    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-lg mx-auto bg-black/70 p-6 rounded-xl border border-red-700 shadow relative">
      <h2 className="text-2xl font-bold text-red-400 mb-2">Session Settings</h2>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Default Blind Length (minutes)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.defaultBlindDuration / 60}
          min={1}
          onChange={e => handleChange("defaultBlindDuration", Number(e.target.value) * 60)}
          disabled={!isAdmin}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Starting Chips</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.startingChips}
          min={1}
          onChange={e => handleChange("startingChips", Number(e.target.value))}
          disabled={!isAdmin}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Buy-In Amount ($)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.buyInAmount}
          min={1}
          onChange={e => handleChange("buyInAmount", Number(e.target.value))}
          disabled={!isAdmin}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Number of Payouts</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.payoutsCount}
          min={1}
          max={10}
          onChange={e => handleChange("payoutsCount", Number(e.target.value))}
          disabled={!isAdmin}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Desired Tournament Length (minutes)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={tournamentLength}
          min={form.defaultBlindDuration / 60}
          onChange={e => setTournamentLength(Number(e.target.value))}
          disabled={!isAdmin}
        />
        <button
          type="button"
          className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 rounded shadow mt-2"
          onClick={handleGenerateBlindLevels}
          disabled={!isAdmin}
        >
          Generate Blind Levels
        </button>
      </div>
      {isAdmin && (
        <button type="submit" className="bg-green-700 hover:bg-green-800 text-white font-bold px-4 py-2 rounded shadow mt-2" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      )}
      {error && <div className="text-red-500 font-bold text-center">{error}</div>}
      {success && <div className="text-green-500 font-bold text-center">{success}</div>}
    </form>
  );
} 