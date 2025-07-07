"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";

export default function StatsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("player_stats")
      .select("*, rooms:room_id(name)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setStats(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Your Poker Stats</h1>
      {loading ? (
        <div>Loading...</div>
      ) : stats.length === 0 ? (
        <div className="text-gray-400">No stats yet. Play some sessions!</div>
      ) : (
        <ul className="flex flex-col gap-4">
          {stats.map((s) => (
            <li key={s.id} className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="font-bold text-lg mb-1">Room: {s.rooms?.name || s.room_id}</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>Sessions: {s.sessions_played}</div>
                <div>Tournaments: {s.tournaments_played}</div>
                <div>Cash Games: {s.cash_games_played}</div>
                <div>Wins: {s.total_wins}</div>
                <div>Losses: {s.total_losses}</div>
                <div>Net Profit: <span className={s.net_profit >= 0 ? "text-green-600" : "text-red-600"}>${s.net_profit}</span></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 