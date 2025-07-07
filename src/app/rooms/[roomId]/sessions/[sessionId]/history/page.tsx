"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SessionHistoryPage() {
  const { sessionId } = useParams();
  const [players, setPlayers] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    supabase.from("sessions").select().eq("id", sessionId).single().then(({ data }) => setSession(data));
    supabase
      .from("session_players")
      .select("*, profile: user_id(*)")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        setPlayers(data || []);
        setLoading(false);
      });
  }, [sessionId]);

  const winner = players.find((p) => p.status !== "eliminated");

  return (
    <div className="max-w-2xl mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-4">Session History</h1>
      {loading || !session ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="mb-2 text-gray-500">Session: <span className="font-mono">{session.name || session.type}</span></div>
          <div className="mb-6 text-gray-500">Session ID: <span className="font-mono text-xs">{session.id}</span></div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Players</h2>
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li key={p.id} className="bg-card border border-border rounded px-4 py-2 flex items-center gap-4">
                  <span className="font-bold">{p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.user_id}</span>
                  <span className="text-xs text-gray-500">Buy-ins: {p.buy_ins} | Rebuys: {p.rebuys}</span>
                  <span className={`text-xs font-bold ${p.status === "eliminated" ? "text-gray-400" : "text-green-600"}`}>{p.status === "eliminated" ? "Eliminated" : "Active"}</span>
                </li>
              ))}
            </ul>
            {winner && (
              <div className="mt-4 text-2xl font-bold text-yellow-500">Winner: {winner.profile?.first_name && winner.profile?.last_name ? `${winner.profile.first_name} ${winner.profile.last_name}` : winner.user_id} 🎉</div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 