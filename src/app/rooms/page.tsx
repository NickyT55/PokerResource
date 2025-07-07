"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RoomsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch rooms the user is a member of
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("room_members")
      .select("*, rooms(*)")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRooms(data?.map((rm: any) => ({ ...rm.rooms, memberId: rm.id })) || []);
        setLoading(false);
      });
  }, [user]);

  // Create a new room
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!createName.trim()) return setError("Room name required");
    // Generate a unique code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ name: createName, code, owner_id: user.id })
      .select()
      .single();
    if (roomError || !room) return setError(roomError?.message || "Room creation failed");
    // Add user as member (admin)
    const { error: memberError } = await supabase.from("room_members").insert({ room_id: room.id, user_id: user.id, role: "admin" });
    if (memberError) return setError(memberError.message);
    setSuccess(`Room created! Code: ${code}`);
    setCreateName("");
    // Fetch the new room and redirect
    const { data: newRoom } = await supabase.from("rooms").select().eq("id", room.id).single();
    if (newRoom) router.push(`/rooms/${newRoom.id}`);
    // Refresh rooms list
    supabase
      .from("room_members")
      .select("*, rooms(*)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRooms(data?.map((rm: any) => ({ ...rm.rooms, memberId: rm.id })) || []);
      });
  };

  // Join a room by code
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!joinCode.trim()) return setError("Room code required");
    // Find room by code
    const { data: room, error: findErr } = await supabase
      .from("rooms")
      .select()
      .eq("code", joinCode.trim().toUpperCase())
      .single();
    if (findErr || !room) return setError("Room not found");
    // Add user as member
    const { error: joinErr } = await supabase
      .from("room_members")
      .insert({ room_id: room.id, user_id: user.id, role: "member" });
    if (joinErr) return setError(joinErr.message);
    setSuccess(`Joined room: ${room.name}`);
    setJoinCode("");
    // Fetch the joined room and redirect
    const { data: joinedRoom } = await supabase.from("rooms").select().eq("id", room.id).single();
    if (joinedRoom) router.push(`/rooms/${joinedRoom.id}`);
    // Refresh rooms list
    supabase
      .from("room_members")
      .select("*, rooms(*)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setRooms(data?.map((rm: any) => ({ ...rm.rooms, memberId: rm.id })) || []);
      });
  };

  return (
    <div className="max-w-2xl mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-6">Your Poker Rooms</h1>
      {loading ? (
        <div>Loading...</div>
      ) : rooms.length === 0 ? (
        <div className="mb-6 text-gray-400">You are not in any rooms yet.</div>
      ) : (
        <ul className="mb-8 flex flex-col gap-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/rooms/${room.id}`} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between hover:bg-accent/10 transition">
                <span className="font-bold text-lg">{room.name}</span>
                <span className="text-xs text-gray-500">Code: {room.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-6">
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
          <div className="font-semibold mb-1">Create a Room</div>
          <input
            type="text"
            placeholder="Room name"
            className="rounded px-3 py-2 border border-border bg-background text-foreground"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            required
          />
          <button className="bg-primary text-primary-foreground font-bold py-2 rounded shadow mt-2" type="submit">
            Create Room
          </button>
        </form>
        <form onSubmit={handleJoin} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
          <div className="font-semibold mb-1">Join a Room</div>
          <input
            type="text"
            placeholder="Room code"
            className="rounded px-3 py-2 border border-border bg-background text-foreground uppercase"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            required
          />
          <button className="bg-accent text-accent-foreground font-bold py-2 rounded shadow mt-2" type="submit">
            Join Room
          </button>
        </form>
        {(error || success) && (
          <div className={`text-center font-bold mt-2 ${error ? "text-red-600" : "text-green-600"}`}>
            {error || success}
          </div>
        )}
      </div>
    </div>
  );
} 