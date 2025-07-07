"use client";
import React, { useEffect, useState } from "react";
import { TournamentHistoryEntry } from "@/types/tournament";

const HISTORY_KEY = "tournament_history";

export default function HistoryPage() {
  const [history, setHistory] = useState<TournamentHistoryEntry[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    }
  }, []);

  const handleDelete = (id: string) => {
    const updated = history.filter((entry) => entry.id !== id);
    setHistory(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 text-white">
      <h1 className="text-3xl font-bold text-red-400 mb-6">Tournament History</h1>
      {history.length === 0 ? (
        <div className="text-gray-400">No tournaments saved yet.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {history.map((entry) => (
            <div key={entry.id} className="bg-black/80 rounded-xl border border-red-700 shadow p-6 relative">
              <button
                className="absolute top-2 right-2 bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs font-bold shadow"
                onClick={() => handleDelete(entry.id)}
                title="Delete Tournament"
              >
                Delete
              </button>
              <div className="flex flex-row justify-between items-center mb-2">
                <div className="text-lg font-bold text-yellow-300">{new Date(entry.date).toLocaleString()}</div>
                <div className="text-lg font-bold text-green-400">Winner: {entry.winner}</div>
              </div>
              <div className="text-gray-300 mb-2">Players: {entry.players.length} | Payouts: {entry.payouts.join(", ")}</div>
              <div className="text-gray-400 text-sm">Buy-in: ${entry.settings.buyInAmount} | Starting Chips: {entry.settings.startingChips}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 