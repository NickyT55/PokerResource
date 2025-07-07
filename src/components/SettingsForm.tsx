"use client";
import React, { useEffect, useState } from "react";
import { useTournamentStore } from "@/store/tournament";

const SETTINGS_KEY = "tournament_settings";
const SOUND_KEY = "tournament_sounds";

function parseBreakLevels(input: string): number[] {
  return input
    .split(",")
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => !isNaN(n));
}

const defaultSounds = {
  alert: "/sounds/alert.mp3",
  break: "/sounds/break.mp3",
};

const SettingsForm = () => {
  const settings = useTournamentStore((s) => s.settings);
  const setSettings = useTournamentStore((s) => s.setSettings);
  const setBlindLevels = useTournamentStore((s) => s.setBlindLevels);
  const recalculatePrizePool = useTournamentStore((s) => s.recalculatePrizePool);
  const setPayouts = useTournamentStore((s) => s.setPayouts);
  const resetTournament = useTournamentStore((s) => s.resetTournament);
  const buyInAmount = useTournamentStore((s) => s.settings.buyInAmount);
  const payoutsCount = useTournamentStore((s) => s.settings.payoutsCount);
  const calculatePayouts = require("@/lib/payouts").calculatePayouts;

  const [form, setForm] = useState(settings);
  const [breakLevelsInput, setBreakLevelsInput] = useState(form.breakLevels.join(","));
  const [tournamentLength, setTournamentLength] = useState(120); // default 2 hours
  const [showConfirm, setShowConfirm] = useState(false);
  const [sounds, setSounds] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SOUND_KEY);
      if (saved) return JSON.parse(saved);
    }
    return defaultSounds;
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm(parsed);
        setBreakLevelsInput(parsed.breakLevels.join(","));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save sounds to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SOUND_KEY, JSON.stringify(sounds));
    }
  }, [sounds]);

  const handleChange = (field: keyof typeof form, value: number | number[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBreakLevelsChange = (value: string) => {
    setBreakLevelsInput(value);
    setForm((prev) => ({ ...prev, breakLevels: parseBreakLevels(value) }));
  };

  // Blind level auto-generation based on desired tournament length
  const handleGenerateBlindLevels = () => {
    const numLevels = Math.ceil((tournamentLength * 60) / form.defaultBlindDuration);
    let small = 50;
    let big = 100;
    const levels = [];
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
    setBlindLevels(levels);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(form));
    setSettings(form);
    handleGenerateBlindLevels();
    recalculatePrizePool();
    setPayouts(calculatePayouts(buyInAmount, payoutsCount));
  };

  const handleReset = () => {
    setShowConfirm(true);
  };

  const confirmReset = () => {
    resetTournament();
    setForm(settings);
    setBreakLevelsInput("");
    setTournamentLength(120);
    setShowConfirm(false);
  };

  const cancelReset = () => {
    setShowConfirm(false);
  };

  // Sound upload handlers
  const handleSoundUpload = (type: "alert" | "break", file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSounds((prev: any) => ({ ...prev, [type]: e.target?.result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-lg mx-auto bg-black/70 p-6 rounded-xl border border-red-700 shadow relative">
      <h2 className="text-2xl font-bold text-red-400 mb-2">Tournament Settings</h2>
      {/* Sound customization */}
      <div className="flex flex-col gap-2 mb-4">
        <label className="text-red-200 font-semibold">Round Change Sound</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => e.target.files && handleSoundUpload("alert", e.target.files[0])}
        />
        <audio controls src={sounds.alert} className="mt-1" />
        <label className="text-red-200 font-semibold mt-4">Break Start Sound</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => e.target.files && handleSoundUpload("break", e.target.files[0])}
        />
        <audio controls src={sounds.break} className="mt-1" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Default Blind Length (minutes)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.defaultBlindDuration / 60}
          min={1}
          onChange={(e) => handleChange("defaultBlindDuration", Number(e.target.value) * 60)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Starting Chips</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.startingChips}
          min={1}
          onChange={(e) => handleChange("startingChips", Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Buy-In Amount ($)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={form.buyInAmount}
          min={1}
          onChange={(e) => handleChange("buyInAmount", Number(e.target.value))}
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
          onChange={(e) => handleChange("payoutsCount", Number(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Break Levels (comma separated)</label>
        <input
          type="text"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={breakLevelsInput}
          onChange={(e) => handleBreakLevelsChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-red-200 font-semibold">Desired Tournament Length (minutes)</label>
        <input
          type="number"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          value={tournamentLength}
          min={form.defaultBlindDuration / 60}
          onChange={(e) => setTournamentLength(Number(e.target.value))}
        />
        <button
          type="button"
          className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 rounded shadow mt-2"
          onClick={handleGenerateBlindLevels}
        >
          Generate Blind Levels
        </button>
      </div>
      <div className="flex gap-4 mt-4">
        <button
          type="submit"
          className="bg-green-700 hover:bg-green-800 text-white font-bold px-4 py-2 rounded shadow"
        >
          Save
        </button>
        <button
          type="button"
          className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 rounded shadow"
          onClick={handleReset}
        >
          Reset Tournament
        </button>
      </div>
      {showConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="bg-neutral-900 border border-red-700 rounded-xl p-8 flex flex-col items-center gap-4 shadow-xl">
            <div className="text-lg text-white font-bold mb-2">Are you sure you want to clear this tournament data?</div>
            <div className="flex gap-4">
              <button
                className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 rounded shadow"
                onClick={confirmReset}
              >
                Yes, Reset
              </button>
              <button
                className="bg-neutral-700 hover:bg-neutral-800 text-white font-bold px-4 py-2 rounded shadow"
                onClick={cancelReset}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default SettingsForm; 