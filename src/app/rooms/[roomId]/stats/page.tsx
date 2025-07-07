"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RoomStatsPage() {
  const { roomId } = useParams();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    (async () => {
      // Fetch all player stats for this room
      const { data: statsData, error } = await supabase
        .from("player_stats")
        .select("*")
        .eq("room_id", roomId);
      if (error) {
        setStats([]);
        setLoading(false);
        return;
      }
      // Fetch all profiles for user_ids
      const userIds = statsData.map((s: any) => s.user_id);
      const { data: profiles } = await supabase
        .from("profile")
        .select("id,first_name,last_name")
        .in("id", userIds);
      // Merge profile info into stats
      const statsWithNames = statsData.map((s: any) => {
        const profile = profiles?.find((pr: any) => pr.id === s.user_id);
        return { ...s, profile };
      });
      setStats(statsWithNames);
      setLoading(false);
    })();
  }, [roomId]);

  return (
    <div className="max-w-2xl mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Room Stats</h1>
      {loading ? (
        <div>Loading...</div>
      ) : stats.length === 0 ? (
        <div className="text-gray-400">No stats yet. Play some sessions!</div>
      ) : (
        <ul className="flex flex-col gap-4">
          {stats.map((s) => (
            <li key={s.user_id} className="bg-card border border-border rounded-lg px-4 py-3">
              <div className="font-bold text-lg mb-1">
                {s.profile?.first_name && s.profile?.last_name
                  ? `${s.profile.first_name} ${s.profile.last_name}`
                  : s.user_id}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div>Sessions: {s.sessions_played}</div>
                <div>Tournaments: {s.tournaments_played}</div>
                <div>Cash Games: {s.cash_games_played}</div>
                <div>Wins: {s.total_wins}</div>
                <div>Losses: {s.total_losses}</div>
                <div>Net Profit: <span className={s.net_profit >= 0 ? "text-green-600" : "text-red-600"}>${s.net_profit}</span></div>
                <div>Last Updated: {s.last_updated ? new Date(s.last_updated).toLocaleString() : "-"}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 