"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import TournamentDashboard from "@/components/TournamentDashboard";

const DEFAULT_LEVELS = [
  { smallBlind: 25, bigBlind: 50, duration: 900 },
  { smallBlind: 50, bigBlind: 100, duration: 900 },
  { smallBlind: 75, bigBlind: 150, duration: 900 },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Update: Helper to sum buy-in amounts
function sumBuyIns(buyInAmounts: number[] | undefined, fallback: number, count: number) {
  if (Array.isArray(buyInAmounts) && buyInAmounts.length > 0) {
    return buyInAmounts.reduce((a, b) => a + b, 0);
  }
  // fallback for legacy data
  return count * fallback;
}

export default function SessionDashboard() {
  const { roomId, sessionId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isPlayer, setIsPlayer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  // Tournament state
  const [clock, setClock] = useState({ running: false, timeLeft: 900 });
  const [currentLevel, setCurrentLevel] = useState(0);
  const [blindLevels, setBlindLevels] = useState(DEFAULT_LEVELS);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Cash game state
  const [ending, setEnding] = useState(false);
  const [ended, setEnded] = useState(false);
  const [cashOutValue, setCashOutValue] = useState("");
  // Track if we've initialized clock/blinds from session state
  const [initialized, setInitialized] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which action is loading
  const [actionSuccess, setActionSuccess] = useState<string | null>(null); // Success message
  // Add modal state for buy-in and cash out
  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [buyInAmountInput, setBuyInAmountInput] = useState('');
  const [cashOutAmountInput, setCashOutAmountInput] = useState('');
  // Add state for admin edit mode
  const [editMode, setEditMode] = useState(false);
  type EditPlayerValues = { buy_ins: number; buy_in_amount: number; cash_out: number | null };
  const [editValues, setEditValues] = useState<Record<string, EditPlayerValues>>({});

  // Fetch session, players, and admin status
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    // Fetch latest session (including settings)
    supabase.from("sessions").select().eq("id", sessionId).single().then(({ data, error }) => {
      if (error) {
        console.error('[SessionDashboard] Error fetching session:', error);
      }
      setSession(data);
      setLoading(false);
    });
    supabase
      .from("session_players")
      .select("*")
      .eq("session_id", sessionId)
      .then(async ({ data, error }) => {
        console.log('[Initial Fetch] Players:', data, 'Error:', error);
        if (data && data.length > 0) {
          // Fetch all profiles for user_ids
          const userIds = data.map((p: any) => p.user_id);
          const { data: profiles, error: profileError } = await supabase
            .from("profile")
            .select("id,first_name,last_name")
            .in("id", userIds);
          // Merge profile info into players
          const playersWithNames = data.map((p: any) => {
            const profile = profiles?.find((pr: any) => pr.id === p.user_id);
            return { ...p, profile };
          });
          setPlayers(playersWithNames);
        } else {
          setPlayers([]);
        }
        setIsPlayer(!!data?.find((p: any) => p.user_id === user?.id));
        setLoading(false);
      });
    // Check if user is admin in room
    supabase
      .from("room_members")
      .select()
      .eq("room_id", roomId)
      .eq("user_id", user?.id)
      .single()
      .then(({ data }) => setAdmin(data?.role === "admin"));
    // Fetch tournament state (TODO: move to DB for real-time sync)
    supabase
      .from("sessions")
      .select("tournament_state")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (data?.tournament_state) {
          const state = typeof data.tournament_state === "string"
            ? JSON.parse(data.tournament_state)
            : data.tournament_state;
          setClock(state.clock);
          setCurrentLevel(state.currentLevel);
          setBlindLevels(state.blindLevels);
        }
      });
  }, [sessionId, user?.id, roomId]);

  // Tournament clock effect (admin only, local for now)
  useEffect(() => {
    if (!admin || !clock.running) return;
    intervalRef.current = setInterval(() => {
      setClock((c) => ({ ...c, timeLeft: c.timeLeft - 1 }));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clock.running, admin]);

  // Auto-advance level (admin only, local for now)
  useEffect(() => {
    if (!admin || !clock.running) return;
    if (clock.timeLeft === 0) {
      if (currentLevel < blindLevels.length - 1) {
        setCurrentLevel(currentLevel + 1);
        setClock({ running: true, timeLeft: blindLevels[currentLevel + 1].duration });
      } else {
        setClock({ running: false, timeLeft: 0 });
      }
    }
  }, [clock.timeLeft, clock.running, currentLevel, blindLevels, admin]);

  // Save tournament state to DB (admin only, local for now)
  useEffect(() => {
    if (!admin) return;
    const state = JSON.stringify({ clock, currentLevel, blindLevels });
    supabase.from("sessions").update({ tournament_state: state }).eq("id", sessionId);
  }, [clock, currentLevel, blindLevels, admin, sessionId]);

  // Check if session is ended (for cash games)
  useEffect(() => {
    if (session && session.type === "cash" && session.ended_at) setEnded(true);
  }, [session]);

  // Real-time updates for players and tournament state
  useEffect(() => {
    if (!sessionId) return;
    // Subscribe to session_players changes
    const playerSub = supabase
      .channel('session_players_' + sessionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` }, payload => {
        supabase
          .from("session_players")
          .select("*")
          .eq("session_id", sessionId)
          .then(async ({ data, error }) => {
            console.log('[Realtime] Player list updated:', data, 'Error:', error);
            if (data && data.length > 0) {
              const userIds = data.map((p: any) => p.user_id);
              const { data: profiles, error: profileError } = await supabase
                .from("profile")
                .select("id,first_name,last_name")
                .in("id", userIds);
              const playersWithNames = data.map((p: any) => {
                const profile = profiles?.find((pr: any) => pr.id === p.user_id);
                return { ...p, profile };
              });
              setPlayers(playersWithNames);
            } else {
              setPlayers([]);
            }
            setIsPlayer(!!data?.find((p: any) => p.user_id === user?.id));
          });
      })
      .subscribe();
    // Subscribe to sessions changes for tournament_state and settings
    const sessionSub = supabase
      .channel('sessions_' + sessionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, payload => {
        console.log('[Realtime] sessions subscription fired:', payload);
        if (payload.new && typeof payload.new === 'object') {
          // Update session object and settings
          setSession(payload.new);
          if ('tournament_state' in payload.new && payload.new.tournament_state) {
            const state = typeof payload.new.tournament_state === "string"
              ? JSON.parse(payload.new.tournament_state)
              : payload.new.tournament_state;
            console.log('[Realtime] Setting state from subscription:', state);
            setClock(state.clock);
            setCurrentLevel(state.currentLevel);
            setBlindLevels(state.blindLevels);
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(playerSub);
      supabase.removeChannel(sessionSub);
    };
  }, [sessionId, user?.id]);

  // When session.settings changes, update blindLevels, buyInAmount, etc. Always update when session changes.
  useEffect(() => {
    if (session && session.settings) {
      if (session.settings.blindLevels) setBlindLevels(session.settings.blindLevels);
      if (session.settings.defaultBlindDuration && blindLevels.length > 0) {
        setBlindLevels((prev) => prev.map((l: any) => ({ ...l, duration: session.settings.defaultBlindDuration })));
      }
      // Optionally update buyInAmount, etc. here if needed
    }
  }, [session]);

  // Clock control handlers: always update tournament_state in DB (admin only)
  const updateTournamentState = async (newClock: any, newCurrentLevel: number, newBlindLevels: any[]) => {
    const state = { clock: newClock, currentLevel: newCurrentLevel, blindLevels: newBlindLevels };
    console.log('[updateTournamentState] PATCH', state);
    const { error, data } = await supabase.from("sessions").update({ tournament_state: state }).eq("id", sessionId).select();
    if (error) {
      console.error('[updateTournamentState] PATCH error:', error);
    } else {
      console.log('[updateTournamentState] PATCH success', data);
    }
  };

  const handleStart = async () => {
    if (!admin) return;
    console.log('[handleStart] Clicked');
    const newClock = { ...clock, running: true };
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handleStart] updateTournamentState called');
  };
  const handlePause = async () => {
    if (!admin) return;
    console.log('[handlePause] Clicked');
    const newClock = { ...clock, running: false };
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handlePause] updateTournamentState called');
  };
  const handleReset = async () => {
    if (!admin) return;
    console.log('[handleReset] Clicked');
    const newClock = { running: false, timeLeft: blindLevels[currentLevel].duration };
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handleReset] updateTournamentState called');
  };
  const handleNextLevel = async () => {
    if (!admin) return;
    console.log('[handleNextLevel] Clicked');
    if (currentLevel < blindLevels.length - 1) {
      const newLevel = currentLevel + 1;
      const newClock = { running: false, timeLeft: blindLevels[newLevel].duration };
      await updateTournamentState(newClock, newLevel, blindLevels);
      console.log('[handleNextLevel] updateTournamentState called');
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    // Always check for user in session_players
    const { data: existing, error: fetchError } = await supabase
      .from("session_players")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (existing) {
      setError("You have already joined this session.");
      setJoining(false);
      refreshPlayers();
      return;
    }
    if (fetchError && fetchError.code !== "PGRST116") {
      setError(fetchError.message);
      setJoining(false);
      return;
    }
    // Do NOT add buy-in on join
    const { error } = await supabase
      .from("session_players")
      .insert({ session_id: sessionId, user_id: user.id, buy_ins: 0, rebuys: 0, status: "active" });
    setJoining(false);
    if (error) setError(error.message);
    refreshPlayers();
  };

  // Prize pool calculation
  const buyInAmount = session?.settings?.buyInAmount || 100;
  const prizePool = players.reduce((sum, p) => sum + ((p.buy_ins || 0) + (p.rebuys || 0)) * buyInAmount, 0);
  const activePlayers = players.filter((p) => p.status !== "eliminated");
  const winner = activePlayers.length === 1 ? activePlayers[0] : null;

  // Cash game pool and net calculations
  const cashGamePool = players.reduce((sum, p) => sum + sumBuyIns(p.buy_in_amounts, p.buy_in_amount || buyInAmount, p.buy_ins || 0) - (p.cash_out || 0), 0);
  const getNet = (p: any) => (p.cash_out || 0) - sumBuyIns(p.buy_in_amounts, p.buy_in_amount || buyInAmount, p.buy_ins || 0);

  // Cash game actions
  const handleCashBuyIn = async () => {
    setActionLoading('buyin');
    setActionSuccess(null);
    setError(null);
    const player = players.find((p) => p.user_id === user.id);
    if (!player) { setError('Player not found'); setActionLoading(null); return; }
    try {
      await supabase.from("session_players").update({ buy_ins: (player.buy_ins || 0) + 1 }).eq("id", player.id);
      setActionSuccess('Buy-in added!');
      refreshPlayers();
    } catch (e) {
      setError('Failed to add buy-in');
    }
    setActionLoading(null);
  };
  const handleCashRebuy = async () => {
    setActionLoading('rebuy');
    setActionSuccess(null);
    setError(null);
    const player = players.find((p) => p.user_id === user.id);
    if (!player) { setError('Player not found'); setActionLoading(null); return; }
    try {
      await supabase.from("session_players").update({ rebuys: (player.rebuys || 0) + 1 }).eq("id", player.id);
      setActionSuccess('Rebuy added!');
      refreshPlayers();
    } catch (e) {
      setError('Failed to add rebuy');
    }
    setActionLoading(null);
  };
  const handleCashOut = async () => {
    setActionLoading('cashout');
    setActionSuccess(null);
    setError(null);
    const player = players.find((p) => p.user_id === user.id);
    if (!player) { setError('Player not found'); setActionLoading(null); return; }
    const value = parseFloat(cashOutValue);
    if (isNaN(value) || value < 0) { setError('Enter a valid cash out amount'); setActionLoading(null); return; }
    try {
      await supabase.from("session_players").update({ cash_out: value }).eq("id", player.id);
      setCashOutValue("");
      setActionSuccess('Cash out updated!');
      refreshPlayers();
    } catch (e) {
      setError('Failed to cash out');
    }
    setActionLoading(null);
  };
  const handleEndSession = async () => {
    if (!window.confirm("Are you sure you want to end this session? This cannot be undone.")) return;
    setEnding(true);
    setActionSuccess(null);
    setError(null);
    try {
      const { error: endError } = await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
      if (endError) {
        setError('Failed to end session');
      } else {
        setEnded(true);
        setActionSuccess('Session ended!');
        try {
          await updatePlayerStats();
        } catch (err) {
          setError('Error updating player stats');
        }
      }
    } catch (e) {
      setError('Failed to end session');
    }
    setEnding(false);
  };

  // Player actions
  const handleBuyIn = async (userId: string) => {
    const player = players.find((p) => p.user_id === userId);
    if (!player) return;
    await supabase.from("session_players").update({ buy_ins: (player.buy_ins || 0) + 1 }).eq("id", player.id);
    refreshPlayers();
  };
  const handleRebuy = async (userId: string) => {
    const player = players.find((p) => p.user_id === userId);
    if (!player) return;
    await supabase.from("session_players").update({ rebuys: (player.rebuys || 0) + 1 }).eq("id", player.id);
    refreshPlayers();
  };
  const handleEliminate = async (playerId: string) => {
    await supabase.from("session_players").update({ status: "eliminated" }).eq("user_id", playerId).eq("session_id", sessionId);
    refreshPlayers();
  };
  const handleRevive = async (playerId: string) => {
    await supabase.from("session_players").update({ status: "active" }).eq("user_id", playerId).eq("session_id", sessionId);
    refreshPlayers();
  };
  const refreshPlayers = () => {
    supabase
      .from("session_players")
      .select("*")
      .eq("session_id", sessionId)
      .then(async ({ data, error }) => {
        console.log('[Refresh] Player list:', data, 'Error:', error, 'User ID:', user?.id, 'Player IDs:', data?.map((p: any) => p.user_id));
        if (data && data.length > 0) {
          const userIds = data.map((p: any) => p.user_id);
          const { data: profiles, error: profileError } = await supabase
            .from("profile")
            .select("id,first_name,last_name")
            .in("id", userIds);
          const playersWithNames = data.map((p: any) => {
            const profile = profiles?.find((pr: any) => pr.id === p.user_id);
            return { ...p, profile };
          });
          setPlayers(playersWithNames);
        } else {
          setPlayers([]);
        }
        setIsPlayer(!!data?.find((p: any) => p.user_id === user?.id));
      });
  };

  // Update stats after session ends
  const updatePlayerStats = async () => {
    if (!session) return;
    const { data: sessionPlayers, error: fetchPlayersError } = await supabase
      .from("session_players")
      .select()
      .eq("session_id", sessionId);
    if (fetchPlayersError) {
      console.error('[updatePlayerStats] Error fetching session players:', fetchPlayersError);
      return;
    }
    if (!sessionPlayers) return;
    for (const p of sessionPlayers) {
      let net = 0;
      let win = 0;
      let loss = 0;
      let placement = null;
      if (session.type === "cash") {
        net = (p.cash_out || 0) - ((p.buy_ins || 0) + (p.rebuys || 0)) * (p.buy_in_amount || buyInAmount);
        win = net > 0 ? 1 : 0;
        loss = net < 0 ? 1 : 0;
      } else if (session.type === "tournament") {
        // Determine placement by elimination order (lower eliminated_at = better placement)
        // Assume session_players has eliminated_at or use status order
        // For now, use status 'winner' for 1st, then order by eliminated
        // TODO: Add eliminated_at or placement field for more accuracy
        // Payout structure: top N get payout, others get 0
        let payout = 0;
        // Example: top 3 get payout, payout structure can be improved
        const payouts = [0.5, 0.3, 0.2]; // 50%, 30%, 20% for 1st, 2nd, 3rd
        const sorted = [...sessionPlayers].sort((a, b) => {
          if (a.status === "winner") return -1;
          if (b.status === "winner") return 1;
          // fallback: by id
          return a.id.localeCompare(b.id);
        });
        placement = sorted.findIndex(sp => sp.id === p.id) + 1;
        if (placement <= payouts.length) {
          payout = payouts[placement - 1] * prizePool;
        }
        net = payout - ((p.buy_ins || 0) + (p.rebuys || 0)) * (p.buy_in_amount || buyInAmount);
        win = payout > 0 ? 1 : 0;
        loss = payout === 0 ? 1 : 0;
      }
      // Fetch existing stats
      const { data: existing, error: fetchStatsError } = await supabase
        .from("player_stats")
        .select()
        .eq("user_id", p.user_id)
        .eq("room_id", session.room_id)
        .single();
      if (fetchStatsError && fetchStatsError.code !== "PGRST116") {
        console.error('[updatePlayerStats] Error fetching player stats:', fetchStatsError);
      }
      const newStats = {
        user_id: p.user_id,
        room_id: session.room_id,
        sessions_played: (existing?.sessions_played || 0) + 1,
        tournaments_played: (existing?.tournaments_played || 0) + (session.type === "tournament" ? 1 : 0),
        cash_games_played: (existing?.cash_games_played || 0) + (session.type === "cash" ? 1 : 0),
        total_wins: (existing?.total_wins || 0) + win,
        total_losses: (existing?.total_losses || 0) + loss,
        net_profit: (existing?.net_profit || 0) + net,
        last_updated: new Date().toISOString(),
      };
      // Optionally store placement for tournaments
      if (session.type === "tournament") {
        (newStats as any).last_placement = placement;
      }
      console.log('[updatePlayerStats] Upserting newStats:', newStats);
      const { error: upsertError } = await supabase.from("player_stats").upsert([newStats], { onConflict: "user_id,room_id" });
      if (upsertError) {
        console.error('[updatePlayerStats] Error upserting player stats:', upsertError);
      }
    }
  };

  // Call updatePlayerStats when session is ended
  useEffect(() => {
    if (session && session.ended_at) {
      updatePlayerStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.ended_at]);

  // Add modal dialogs for buy-in and cash out
  const openBuyInModal = () => { setBuyInAmountInput(''); setShowBuyInModal(true); };
  const openCashOutModal = () => { setCashOutAmountInput(''); setShowCashOutModal(true); };
  const closeBuyInModal = () => setShowBuyInModal(false);
  const closeCashOutModal = () => setShowCashOutModal(false);

  const handleBuyInSubmit = async () => {
    setActionLoading('buyin');
    setActionSuccess(null);
    setError(null);
    const player = players.find((p) => p.user_id === user.id);
    if (!player) { setError('Player not found'); setActionLoading(null); return; }
    const value = parseFloat(buyInAmountInput);
    if (isNaN(value) || value <= 0) { setError('Enter a valid buy-in amount'); setActionLoading(null); return; }
    try {
      // Append to buy_in_amounts array
      const prev = Array.isArray(player.buy_in_amounts) ? player.buy_in_amounts : [];
      const newArr = [...prev, value];
      await supabase.from("session_players").update({
        buy_ins: (player.buy_ins || 0) + 1,
        buy_in_amount: value, // for legacy fallback
        buy_in_amounts: newArr
      }).eq("id", player.id);
      setActionSuccess('Buy-in added!');
      refreshPlayers();
      closeBuyInModal();
    } catch (e) {
      setError('Failed to add buy-in');
    }
    setActionLoading(null);
  };
  const handleCashOutSubmit = async () => {
    setActionLoading('cashout');
    setActionSuccess(null);
    setError(null);
    const player = players.find((p) => p.user_id === user.id);
    if (!player) { setError('Player not found'); setActionLoading(null); return; }
    const value = parseFloat(cashOutAmountInput);
    if (isNaN(value) || value < 0) { setError('Enter a valid cash out amount'); setActionLoading(null); return; }
    try {
      await supabase.from("session_players").update({ cash_out: value }).eq("id", player.id);
      setActionSuccess('Cash out updated!');
      refreshPlayers();
      closeCashOutModal();
    } catch (e) {
      setError('Failed to cash out');
    }
    setActionLoading(null);
  };

  // Handler to start editing
  const handleEditClick = () => {
    // Initialize editValues with current player data
    const values: Record<string, EditPlayerValues> = {};
    players.forEach(p => {
      values[p.id] = {
        buy_ins: p.buy_ins,
        buy_in_amount: p.buy_in_amount,
        cash_out: p.cash_out
      };
    });
    setEditValues(values);
    setEditMode(true);
  };

  // Handler to change a value
  const handleEditChange = (playerId: string, field: keyof EditPlayerValues, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [field]: field === 'cash_out' || field === 'buy_in_amount' ? (value === '' ? null : Number(value)) : Number(value)
      }
    }));
  };

  // Handler to save edits
  const handleEditSave = async () => {
    setActionLoading('edit');
    setError(null);
    try {
      for (const playerId in editValues) {
        const vals = editValues[playerId];
        await supabase.from('session_players').update({
          buy_ins: Number(vals.buy_ins),
          buy_in_amount: Number(vals.buy_in_amount),
          cash_out: vals.cash_out === null ? null : Number(vals.cash_out)
        }).eq('id', playerId);
      }
      setEditMode(false);
      refreshPlayers();
    } catch (e) {
      setError('Failed to save edits');
    }
    setActionLoading(null);
  };

  // Handler to cancel edits
  const handleEditCancel = () => {
    setEditMode(false);
    setEditValues({});
  };

  return (
    <div>
      {loading || !session ? (
        <div>Loading...</div>
      ) : session.type === "tournament" ? (
        <TournamentDashboard
          session={session}
          players={players}
          admin={admin}
          currentLevel={currentLevel}
          clock={clock}
          blindLevels={blindLevels}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onNextLevel={handleNextLevel}
          onEliminate={handleEliminate}
          onRevive={handleRevive}
          onBuyIn={handleBuyIn}
          onRebuy={handleRebuy}
          winner={winner}
          prizePool={prizePool}
          isPlayer={isPlayer}
          onJoin={handleJoin}
          joining={joining}
          error={error}
          onEndSession={admin ? handleEndSession : undefined}
          ending={ending}
        />
      ) : (
        <div className="max-w-2xl mx-auto p-8 text-foreground">
          <h1 className="text-3xl font-bold mb-2">{session.name || session.type}</h1>
          <div className="mb-2 text-gray-500">Type: <span className="font-mono">{session.type}</span></div>
          <div className="mb-6 text-gray-500">Session ID: <span className="font-mono text-xs">{session.id}</span></div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Players</h2>
            <div className="mb-2 text-green-600 font-bold">Prize Pool: ${prizePool}</div>
            {players.length === 0 ? (
              <div className="text-gray-400">No players yet.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {players.map((p) => (
                  <li key={p.id} className={`bg-zinc-900 border border-zinc-700 rounded px-4 py-2 flex items-center gap-4 ${p.user_id === user.id ? 'ring-2 ring-primary' : ''}`}>
                    <span className="font-bold text-white">{p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.user_id}</span>
                    {editMode ? (
                      <>
                        <input type="number" min="0" className="w-16 rounded bg-zinc-800 text-white border border-zinc-700 px-1 py-0.5" value={editValues[p.id]?.buy_ins ?? ''} onChange={e => handleEditChange(p.id, 'buy_ins', e.target.value)} />
                        <input type="number" min="0" step="0.01" className="w-20 rounded bg-zinc-800 text-white border border-zinc-700 px-1 py-0.5" value={editValues[p.id]?.buy_in_amount ?? ''} onChange={e => handleEditChange(p.id, 'buy_in_amount', e.target.value)} />
                        <input type="number" min="0" step="0.01" className="w-20 rounded bg-zinc-800 text-white border border-zinc-700 px-1 py-0.5" value={editValues[p.id]?.cash_out ?? ''} onChange={e => handleEditChange(p.id, 'cash_out', e.target.value)} />
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400">Buy-ins: <span className="text-white">{p.buy_ins}</span></span>
                        <span className="text-xs text-blue-300">Total Buy-ins: <span className="text-white">${sumBuyIns(p.buy_in_amounts, p.buy_in_amount || buyInAmount, p.buy_ins || 0)}</span></span>
                        {Array.isArray(p.buy_in_amounts) && p.buy_in_amounts.length > 0 && (
                          <span className="text-xs text-gray-400">[ {p.buy_in_amounts.join(", ")} ]</span>
                        )}
                        <span className="text-xs text-blue-300">Cash Out: <span className="text-white">{p.cash_out !== undefined && p.cash_out !== null && p.cash_out !== '' ? `$${p.cash_out}` : '--'}</span></span>
                      </>
                    )}
                    <span className={`text-xs font-bold ${getNet(p) >= 0 ? 'text-green-400' : 'text-red-400'}`}>Net: {getNet(p) >= 0 ? '+' : ''}${getNet(p)}</span>
                    {p.user_id === user.id && !ended && !editMode && (
                      <>
                        <button className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs ml-2" onClick={openBuyInModal} disabled={actionLoading === 'buyin'}>Buy-in</button>
                        <button className="bg-blue-700 text-white rounded px-2 py-1 text-xs ml-1" onClick={openCashOutModal} disabled={actionLoading === 'cashout'}>Cash Out</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {winner && (
              <div className="mt-4 text-2xl font-bold text-yellow-500">Winner: {winner.profile?.first_name && winner.profile?.last_name ? `${winner.profile.first_name} ${winner.profile.last_name}` : winner.user_id} 🎉</div>
            )}
          </div>
          {!isPlayer && (
            <button
              className="bg-primary text-primary-foreground font-bold py-2 px-6 rounded shadow mb-4"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? "Joining..." : "Join Session"}
            </button>
          )}
          {error && <div className="text-red-600 text-sm text-center mb-2">{error}</div>}
          {actionSuccess && <div className="text-green-600 text-sm text-center mb-2">{actionSuccess}</div>}
          {session.type === "cash" && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">Cash Game Pool</h2>
              <div className="text-4xl font-mono font-bold text-green-500 mb-4">${cashGamePool}</div>
            </div>
          )}
          {session.type === "cash" && players.length > 0 && (
            <div className="mt-10 bg-zinc-900 border border-zinc-700 rounded-lg p-6 text-white">
              <h3 className="text-xl font-bold mb-4 text-yellow-400">Player Rankings (Net Outcome)</h3>
              <ol className="space-y-2">
                {[...players].sort((a, b) => getNet(b) - getNet(a)).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-4">
                    <span className="text-lg font-bold w-8 text-yellow-300">#{i + 1}</span>
                    <span className="font-semibold text-white">{p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.user_id}</span>
                    <span className={`ml-auto font-mono font-bold ${getNet(p) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{getNet(p) >= 0 ? '+' : ''}${getNet(p)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {showBuyInModal && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl flex flex-col gap-6 border border-zinc-700 w-full max-w-sm">
                <h2 className="text-2xl font-bold text-primary-foreground mb-2">Buy-In</h2>
                <p className="text-white text-sm mb-2">Enter your buy-in amount below. This is the amount you are buying in for this cash game session.</p>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="border border-zinc-700 rounded px-3 py-2 bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  value={buyInAmountInput}
                  onChange={e => setBuyInAmountInput(e.target.value)}
                  placeholder="Buy-in amount"
                  aria-label="Buy-in amount"
                  autoFocus
                />
                <div className="flex gap-4 justify-end">
                  <button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded px-4 py-2 font-bold" onClick={handleBuyInSubmit} disabled={actionLoading === 'buyin'}>
                    Confirm
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2 font-bold" onClick={closeBuyInModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {showCashOutModal && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl flex flex-col gap-6 border border-zinc-700 w-full max-w-sm">
                <h2 className="text-2xl font-bold text-blue-300">Cash Out</h2>
                <p className="text-white text-sm">Enter the amount you wish to cash out. This will finalize your session and cannot be changed after submission.</p>
                <input type="number" min="0" step="0.01" className="border border-zinc-700 rounded px-3 py-2 bg-zinc-800 text-white" value={cashOutAmountInput} onChange={e => setCashOutAmountInput(e.target.value)} placeholder="Cash out amount" />
                <div className="flex gap-4 justify-end">
                  <button className="bg-blue-700 hover:bg-blue-800 text-white rounded px-4 py-2 font-bold" onClick={handleCashOutSubmit} disabled={actionLoading === 'cashout'}>Confirm Cash Out</button>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2 font-bold" onClick={closeCashOutModal}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {admin && !editMode && (
            <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-4 rounded shadow text-sm mb-4" onClick={handleEditClick}>
              Edit Values
            </button>
          )}
          {admin && editMode && (
            <div className="flex gap-2 mt-4 mb-4">
              <button className="bg-green-700 hover:bg-green-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleEditSave} disabled={actionLoading === 'edit'}>Save</button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleEditCancel} disabled={actionLoading === 'edit'}>Cancel</button>
            </div>
          )}
          {admin && !ended && (
            <div className="flex justify-center mt-8 mb-4">
              <button
                className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-6 rounded shadow text-lg"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to end this session? This cannot be undone.')) {
                    setEnding(true);
                    setActionSuccess(null);
                    setError(null);
                    try {
                      const { error: endError } = await supabase.from("sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
                      if (endError) {
                        setError('Failed to end session');
                      } else {
                        setEnded(true);
                        setActionSuccess('Session ended!');
                        try {
                          await updatePlayerStats();
                        } catch (err) {
                          setError('Error updating player stats');
                        }
                      }
                    } catch (e) {
                      setError('Failed to end session');
                    }
                    setEnding(false);
                  }
                }}
                disabled={ending}
              >
                {ending ? 'Ending...' : 'End Session'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 