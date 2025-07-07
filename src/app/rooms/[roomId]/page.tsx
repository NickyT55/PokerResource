"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function RoomDashboard() {
  const { roomId } = useParams();
  const router = useRouter();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sessionType, setSessionType] = useState("tournament");
  const [sessionName, setSessionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    // Fetch room info
    supabase.from("rooms").select().eq("id", roomId).single().then(({ data }) => setRoom(data));
    // Fetch members (no profile join)
    supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .then(async ({ data }) => {
        if (!data) return setMembers([]);
        // Fetch all profiles for user_ids
        const userIds = data.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from("profile")
          .select("id,first_name,last_name")
          .in("id", userIds);
        // Merge profile info into members
        const membersWithNames = data.map((m: any) => {
          const profile = profiles?.find((pr: any) => pr.id === m.user_id);
          return { ...m, profile };
        });
        setMembers(membersWithNames);
      });
    // Fetch sessions
    supabase
      .from("sessions")
      .select()
      .eq("room_id", roomId)
      .order("started_at", { ascending: false })
      .then(({ data }) => setSessions(data || []));
    // Check if the user is an admin
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return setAdmin(false);
      supabase
        .from("room_members")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", userData.user.id)
        .single()
        .then(({ data }) => {
          setAdmin(data?.role === "admin");
        });
    })();
    setLoading(false);
  }, [roomId]);

  // Find current live session (not ended)
  const liveSession = useMemo(() => sessions.find((s) => !s.ended_at), [sessions]);
  // Find session history (ended sessions)
  const sessionHistory = useMemo(() => sessions.filter((s) => s.ended_at), [sessions]);

  // Delete room (admin only)
  const handleDeleteRoom = async () => {
    if (!window.confirm("Are you sure you want to delete this room? This cannot be undone.")) return;
    await supabase.from("rooms").delete().eq("id", roomId);
    router.push("/rooms");
  };

  // Delete session (admin only)
  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    await supabase.from("sessions").delete().eq("id", sessionId);
    // Refresh sessions
    supabase
      .from("sessions")
      .select()
      .eq("room_id", roomId)
      .order("started_at", { ascending: false })
      .then(({ data }) => setSessions(data || []));
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sessionType) return setError("Session type required");
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        room_id: roomId,
        type: sessionType,
        name: sessionName,
      })
      .select()
      .single();
    if (error) return setError(error.message);
    setShowForm(false);
    setSessionName("");
    setSessionType("tournament");
    // Refresh sessions and redirect to dashboard
    supabase
      .from("sessions")
      .select()
      .eq("room_id", roomId)
      .order("started_at", { ascending: false })
      .then(({ data: sessionList }) => {
        setSessions(sessionList || []);
        if (data?.id) router.push(`/rooms/${roomId}/sessions/${data.id}`);
      });
  };

  // Start session handler (admin only)
  const handleStartSession = () => setShowForm(true);
  // Join session handler
  const handleJoinSession = () => {
    if (liveSession) router.push(`/rooms/${roomId}/sessions/${liveSession.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 text-foreground">
      {loading || !room ? (
        <div>Loading...</div>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-2">{room.name}</h1>
          <div className="mb-4 text-gray-500">Room Code: <span className="font-mono text-lg">{room.code}</span></div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Members</h2>
            <ul className="flex flex-wrap gap-3">
              {members.map((m) => (
                <li key={m.id} className="bg-card border border-border rounded px-3 py-1 text-sm">
                  {m.profile?.first_name && m.profile?.last_name ? `${m.profile.first_name} ${m.profile.last_name}` : m.user_id}
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-8">
            {/* Session controls */}
            {admin && !liveSession && (
              <button className="bg-primary text-primary-foreground font-bold py-2 px-6 rounded shadow mb-4" onClick={handleStartSession}>
                Start Session
              </button>
            )}
            {liveSession && (
              <button className="bg-blue-700 text-white font-bold py-2 px-6 rounded shadow mb-4" onClick={handleJoinSession}>
                Join Live Session
              </button>
            )}
            {/* Show current live session */}
            {liveSession && (
              <div className="mb-4">
                <div className="text-lg font-semibold">Current Session:</div>
                <div className="bg-card border border-border rounded px-4 py-2 flex items-center justify-between">
                  <span className="font-bold">{liveSession.name || liveSession.type}</span>
                  <span className="text-xs text-gray-500">{liveSession.type} • {new Date(liveSession.started_at).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
          {/* Session history */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Session History</h2>
            {sessionHistory.length === 0 ? (
              <div className="text-gray-400">No sessions yet.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessionHistory.map((s) => (
                  <li key={s.id} className="relative">
                    <Link href={`/rooms/${roomId}/sessions/${s.id}`} className="bg-card border border-border rounded px-4 py-2 flex items-center justify-between hover:bg-accent/10 transition">
                      <span className="font-bold">{s.name || s.type}</span>
                      <span className="text-xs text-gray-500">{s.type} • {new Date(s.started_at).toLocaleString()}</span>
                    </Link>
                    {admin && (
                      <button
                        className="absolute top-2 right-2 bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs font-bold shadow"
                        onClick={() => handleDeleteSession(s.id)}
                        title="Delete Session"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {showForm ? (
            <form onSubmit={handleCreateSession} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 mb-6">
              <div className="font-semibold mb-1">Start New Session</div>
              <label className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="type"
                  value="tournament"
                  checked={sessionType === "tournament"}
                  onChange={() => setSessionType("tournament")}
                />
                Tournament
              </label>
              <label className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="type"
                  value="cash"
                  checked={sessionType === "cash"}
                  onChange={() => setSessionType("cash")}
                />
                Cash Game
              </label>
              <input
                type="text"
                placeholder="Session name (optional)"
                className="rounded px-3 py-2 border border-border bg-background text-foreground"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
              />
              {error && <div className="text-red-600 text-sm text-center">{error}</div>}
              <div className="flex gap-2 mt-2">
                <button className="bg-primary text-primary-foreground font-bold py-2 rounded shadow flex-1" type="submit">
                  Create Session
                </button>
                <button className="bg-muted text-muted-foreground font-bold py-2 rounded shadow flex-1" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {admin && (
            <button
              className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-6 rounded shadow mb-6"
              onClick={handleDeleteRoom}
            >
              Delete Room
            </button>
          )}
        </>
      )}
    </div>
  );
} 