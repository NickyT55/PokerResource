"use client";

import SettingsForm from "@/components/SettingsForm";
import { useTournamentStore } from "@/store/tournament";

export default function SettingsPage() {
  const setClock = useTournamentStore((s) => s.setClock);
  // Note: breakRunning is managed locally in Clock, so we cannot pause break timer from here
  const handlePauseTournament = () => {
    setClock(false);
    // TODO: To pause break timer globally, lift break state to store
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <button
        className="w-full mb-4 bg-yellow-800 hover:bg-yellow-900 text-white font-bold py-2 px-4 rounded shadow text-sm"
        onClick={handlePauseTournament}
      >
        Pause Current Tournament
      </button>
      <SettingsForm />
    </div>
  );
} 