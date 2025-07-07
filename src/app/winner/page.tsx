"use client";
import React, { useEffect, useState } from "react";
import { useTournamentStore } from "@/store/tournament";
import Confetti from "react-confetti";
import { useRouter } from "next/navigation";

const HISTORY_KEY = "tournament_history";

export default function WinnerPage() {
  const players = useTournamentStore((s) => s.players);
  const winner = players.find((p) => p.status !== "eliminated");
  const router = useRouter();
  const saveTournamentToHistory = useTournamentStore((s) => s.saveTournamentToHistory);
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    function handleResize() {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && winner) {
      const prev = localStorage.getItem(HISTORY_KEY);
      if (prev) {
        const arr = JSON.parse(prev);
        if (arr.length && arr[0].winner === winner.name) {
          setSaved(true);
        }
      }
    }
  }, [winner]);

  const handleSave = () => {
    saveTournamentToHistory();
    setSaved(true);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-red-900 to-black text-white">
      {mounted && (
        <Confetti
          width={dimensions.width}
          height={dimensions.height}
          recycle={true}
          numberOfPieces={400}
          gravity={0.2}
        />
      )}
      <div className="z-10 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl font-bold text-yellow-400 drop-shadow-lg">🏆</span>
          <h1 className="text-4xl font-extrabold text-yellow-300 mb-2 drop-shadow-lg">Congratulations!</h1>
          <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">{mounted && winner ? winner.name : "Winner"}</h2>
        </div>
        <div className="mt-8 text-lg text-gray-300">You are the last player standing!</div>
        {!saved ? (
          <button
            className="mt-8 px-8 py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold text-lg shadow-lg border border-green-900"
            onClick={handleSave}
          >
            Save Tournament to History
          </button>
        ) : (
          <div className="mt-8 text-green-400 font-bold">Tournament saved to history!</div>
        )}
        <button
          className="mt-4 px-8 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-lg shadow-lg border border-red-900"
          onClick={() => router.push("/")}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
} 