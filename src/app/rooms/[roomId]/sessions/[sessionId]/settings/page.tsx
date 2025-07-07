"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SessionSettingsForm from "@/components/SessionSettingsForm";
import { useAuth } from "@/lib/authContext";

export default function SessionSettingsPage() {
  const { sessionId, roomId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    supabase.from("sessions").select().eq("id", String(sessionId)).single().then(({ data }) => {
      setSession(data);
      setLoading(false);
    });
    // Check admin status
    if (roomId && user?.id) {
      supabase
        .from("room_members")
        .select()
        .eq("room_id", String(roomId))
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setIsAdmin(data?.role === "admin"));
    }
  }, [sessionId, roomId, user?.id]);

  return (
    <div className="max-w-xl mx-auto p-8 text-foreground">
      <h1 className="text-3xl font-bold mb-4">Session Settings</h1>
      {loading || !session ? (
        <div>Loading...</div>
      ) : (
        <SessionSettingsForm sessionId={String(sessionId)} initialSettings={session.settings} isAdmin={isAdmin} />
      )}
    </div>
  );
} 