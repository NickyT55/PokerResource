"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import TournamentDashboard from "@/components/TournamentDashboard";
import Clock from "@/components/Clock";
import PayoutTable from "@/components/PayoutTable";
import BlindLevelList from "@/components/BlindLevelList";
import { useTournamentStore } from "@/store/tournament";

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

function SetLevelPopover({ currentLevel, blindLevels, onSetLevel }: { currentLevel: number, blindLevels: any[], onSetLevel: (level: number) => void }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative mt-1">
      <button
        className="text-xs text-red-200 bg-black/30 hover:bg-black/60 rounded px-2 py-1 border border-red-700 transition-opacity opacity-60 hover:opacity-100"
        onClick={() => setOpen((v) => !v)}
        tabIndex={0}
      >
        Set Level
      </button>
      {open && (
        <div ref={popoverRef} className="absolute left-1/2 -translate-x-1/2 mt-2 z-50 bg-zinc-900 border border-red-700 rounded shadow-lg p-3 flex flex-col gap-2 min-w-[180px]">
          <label htmlFor="set-level-dropdown" className="text-xs text-red-200 font-semibold mb-1">Jump to Level:</label>
          <select
            id="set-level-dropdown"
            className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1 text-sm"
            value={currentLevel}
            onChange={e => {
              const newLevel: number = Number(e.target.value);
              onSetLevel(newLevel);
              setOpen(false);
            }}
            autoFocus
          >
            {blindLevels.map((level, idx) => (
              <option key={idx} value={idx}>
                Level {idx + 1}: {level.smallBlind} / {level.bigBlind}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use Zustand store for blind levels
  const blindLevels = useTournamentStore((s) => s.blindLevels);
  const setBlindLevels = useTournamentStore((s) => s.setBlindLevels);
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
  const [room, setRoom] = useState<any>(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyIns, setNewPlayerBuyIns] = useState(1);
  // Add state to track manually added player names
  const [manualPlayerNames, setManualPlayerNames] = useState<Record<string, string>>({});

  // Fetch session, players, and admin status
  useEffect(() => {
    if (!sessionId || !roomId) return;
    setLoading(true);
    // Fetch latest session (including settings)
    supabase.from("sessions").select().eq("id", sessionId).single().then(({ data, error }) => {
      if (error) {
        console.error('[SessionDashboard] Error fetching session:', error);
      }
      setSession(data);
      setLoading(false);
    });
    // Fetch room info for code
    supabase.from("rooms").select().eq("id", roomId).single().then(({ data }) => setRoom(data));
    supabase
      .from("session_players")
      .select("*")
      .eq("session_id", sessionId)
      .then(async ({ data, error }) => {
        console.log('[Initial Fetch] Players:', data, 'Error:', error);
        if (data && data.length > 0) {
          // Filter out manually added players (manual_ prefix) for profile lookup
          const realUserIds = data.filter((p: any) => !p.user_id.startsWith('manual_')).map((p: any) => p.user_id);
          
          let profiles: any[] = [];
          if (realUserIds.length > 0) {
            const { data: profileData, error: profileError } = await supabase
              .from("profile")
              .select("id,first_name,last_name")
              .in("id", realUserIds);
            profiles = profileData || [];
          }
          
          // Merge profile info into players
          const playersWithNames = data.map((p: any) => {
            // For manually added players, don't look for profile
            if (p.user_id.startsWith('manual_')) {
              return { ...p, profile: null };
            }
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
      .then(({ data }) => {
        console.log('[Admin Check] Room member data:', data, 'User ID:', user?.id, 'Room ID:', roomId);
        const isAdmin = data?.role === "admin";
        console.log('[Admin Check] Setting admin to:', isAdmin);
        setAdmin(isAdmin);
      });
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
          if (state.blindLevels) {
            setBlindLevels(state.blindLevels);
          }
        }
      });
  }, [sessionId, user?.id, roomId]);

  // Tournament clock effect (admin only, local for now)
  useEffect(() => {
    if (!admin || !clock.running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      setClock((c) => {
        const newTimeLeft = Math.max(0, c.timeLeft - 1);
        console.log('[Clock Tick] Time left:', newTimeLeft);
        return { ...c, timeLeft: newTimeLeft };
      });
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clock.running, admin]);

  // Auto-advance level (admin only, local for now)
  useEffect(() => {
    if (!admin || !clock.running || clock.timeLeft > 0) return;
    
    console.log('[Auto-advance] Clock reached 0, current level:', currentLevel);
    if (currentLevel < blindLevels.length - 1) {
      // Normal level advancement
      const newLevel = currentLevel + 1;
      console.log('[Auto-advance] Advancing to level:', newLevel);
      
      // Stop the current interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Update state
      setCurrentLevel(newLevel);
      setClock({ running: true, timeLeft: blindLevels[newLevel].duration });
      
      // Update tournament state in DB
      updateTournamentState({ running: true, timeLeft: blindLevels[newLevel].duration }, newLevel, blindLevels);
    } else {
      console.log('[Auto-advance] Tournament finished');
      
      // Stop the current interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setClock({ running: false, timeLeft: 0 });
      updateTournamentState({ running: false, timeLeft: 0 }, currentLevel, blindLevels);
    }
  }, [clock.timeLeft, clock.running, currentLevel, blindLevels, admin]);

  // Save tournament state to DB (admin only, local for now)
  // REMOVED: This was causing the clock to glitch by saving on every tick
  // Now we only save when explicitly updating tournament state

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
              // Filter out manually added players (manual_ prefix) for profile lookup
              const realUserIds = data.filter((p: any) => !p.user_id.startsWith('manual_')).map((p: any) => p.user_id);
              
              let profiles: any[] = [];
              if (realUserIds.length > 0) {
                const { data: profileData, error: profileError } = await supabase
                  .from("profile")
                  .select("id,first_name,last_name")
                  .in("id", realUserIds);
                profiles = profileData || [];
              }
              
              const playersWithNames = data.map((p: any) => {
                // For manually added players, don't look for profile
                if (p.user_id.startsWith('manual_')) {
                  return { ...p, profile: null };
                }
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
            console.log('[Realtime] Current level before update:', currentLevel, 'New level from subscription:', state.currentLevel);
            
            // Only update clock state if it's not currently running locally
            // This prevents the subscription from interfering with the local clock
            if (!clock.running) {
              setClock(state.clock);
              setCurrentLevel(state.currentLevel);
              setBlindLevels(state.blindLevels);
            } else {
              // If clock is running locally, only update non-clock state
              setCurrentLevel(state.currentLevel);
              setBlindLevels(state.blindLevels);
            }
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(playerSub);
      supabase.removeChannel(sessionSub);
    };
  }, [sessionId, user?.id, clock.running]);

  // When session.settings changes, update blindLevels, buyInAmount, etc. Always update when session changes.
  useEffect(() => {
    if (session && session.settings) {
      console.log('[Settings Effect] Session settings updated:', session.settings);
      
      if (session.settings.blindLevels) {
        console.log('[Settings Effect] Updating blind levels from settings:', session.settings.blindLevels);
        setBlindLevels(session.settings.blindLevels);
      }
      
      if (session.settings.defaultBlindDuration && blindLevels.length > 0) {
        console.log('[Settings Effect] Updating durations to:', session.settings.defaultBlindDuration);
        const newBlindLevels = blindLevels.map((l: any) => ({ ...l, duration: session.settings.defaultBlindDuration }));
        setBlindLevels(newBlindLevels);
      }
      
      // Update tournament state in database with new blind levels (admin only)
      if (admin) {
        console.log('[Settings Effect] Updating tournament state with new blind levels');
        updateTournamentState(clock, currentLevel, blindLevels);
      }
    }
  }, [session, blindLevels]);

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
    
    // Stop any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const newClock = { ...clock, running: true };
    setClock(newClock);
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handleStart] Clock started');
  };
  
  const handlePause = async () => {
    if (!admin) return;
    console.log('[handlePause] Clicked');
    
    // Stop the interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const newClock = { ...clock, running: false };
    setClock(newClock);
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handlePause] Clock paused');
  };
  
  const handleReset = async () => {
    if (!admin) return;
    console.log('[handleReset] Clicked');
    
    // Stop any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const newClock = { running: false, timeLeft: blindLevels[currentLevel].duration };
    setClock(newClock);
    await updateTournamentState(newClock, currentLevel, blindLevels);
    console.log('[handleReset] Clock reset');
  };
  
  const handleNextLevel = async () => {
    if (!admin) return;
    console.log('[handleNextLevel] Clicked - Current level:', currentLevel, 'Moving to level:', currentLevel + 1);
    if (currentLevel < blindLevels.length - 1) {
      // Stop any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      const newLevel = currentLevel + 1;
      const newClock = { running: false, timeLeft: blindLevels[newLevel].duration };
      setCurrentLevel(newLevel);
      setClock(newClock);
      await updateTournamentState(newClock, newLevel, blindLevels);
      console.log('[handleNextLevel] Advanced to level', newLevel);
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
  const prizePool = players.reduce((sum, p) => sum + (p.buy_ins || 0) * buyInAmount, 0);
  const activePlayers = players.filter((p) => p.status !== "eliminated");
  const winner = activePlayers.length === 1 ? activePlayers[0] : null;

  // Cash game pool and net calculations
  const cashGamePool = players.reduce((sum, p) => sum + sumBuyIns(p.buy_in_amounts, p.buy_in_amount || buyInAmount, p.buy_ins || 0) - (p.cash_out || 0), 0);
  const getNet = (p: any) => (p.cash_out || 0) - sumBuyIns(p.buy_in_amounts, p.buy_in_amount || buyInAmount, p.buy_ins || 0);

  // Cash game actions
  const handleCashBuyIn = async () => {
    if (!window.confirm('Are you sure you want to add a buy-in?')) return;
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

  const handleCashOut = async () => {
    if (!window.confirm('Are you sure you want to cash out? This action cannot be undone.')) return;
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
    if (!window.confirm(`Are you sure you want to add a buy-in for ${player.profile?.first_name && player.profile?.last_name ? `${player.profile.first_name} ${player.profile.last_name}` : player.user_id}?`)) return;
    await supabase.from("session_players").update({ buy_ins: (player.buy_ins || 0) + 1 }).eq("id", player.id);
    refreshPlayers();
  };
  const handleSubtractBuyIn = async (userId: string) => {
    const player = players.find((p) => p.user_id === userId);
    if (!player) return;
    if (!window.confirm(`Are you sure you want to subtract a buy-in from ${player.profile?.first_name && player.profile?.last_name ? `${player.profile.first_name} ${player.profile.last_name}` : player.user_id}?`)) return;
    await supabase.from("session_players").update({ buy_ins: Math.max(0, (player.buy_ins || 0) - 1) }).eq("id", player.id);
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

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setError('Please enter a player name');
      return;
    }
    
    setActionLoading('addplayer');
    setError(null);
    
    try {
      // Generate a proper UUID for the user_id
      const playerUserId = crypto.randomUUID();
      
      // Check if a player with this name already exists in the session
      const existingPlayer = players.find(p => 
        p.user_id?.startsWith('manual_') && 
        p.user_id.replace('manual_', '').split('_').slice(0, -1).join(' ').toLowerCase() === newPlayerName.trim().toLowerCase()
      );
      
      if (existingPlayer) {
        setError('A player with this name already exists in the session');
        setActionLoading(null);
        return;
      }
      
      // Try a simpler insert first with minimal required fields
      const simplePlayerData = {
        session_id: sessionId,
        user_id: playerUserId,
        buy_ins: newPlayerBuyIns || 1,
        status: "active"
      };
      
      console.log('[handleAddPlayer] Trying simple insert:', simplePlayerData);
      
      // Test database connection first
      console.log('[handleAddPlayer] Testing database connection...');
      const { data: testData, error: testError } = await supabase
        .from("session_players")
        .select("id")
        .limit(1);
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        setError(`Database connection failed: ${testError.message}`);
        setActionLoading(null);
        return;
      }
      
      console.log('[handleAddPlayer] Database connection test successful');
      
      const { data, error } = await supabase
        .from("session_players")
        .insert(simplePlayerData)
        .select();
      
      if (error) {
        console.error('Error adding player:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Try to get more info about the error
        if (error.code) {
          console.error('Error code:', error.code);
        }
        if (error.message) {
          console.error('Error message:', error.message);
        }
        if (error.details) {
          console.error('Error details:', error.details);
        }
        if (error.hint) {
          console.error('Error hint:', error.hint);
        }
        
        setError(`Failed to add player: ${error.message || 'Unknown database error'}`);
        setActionLoading(null);
        return;
      }
      
      console.log('[handleAddPlayer] Player added successfully:', data);
      
      // Store the player name in our local mapping
      if (data && data[0]) {
        setManualPlayerNames(prev => ({
          ...prev,
          [data[0].user_id]: newPlayerName.trim()
        }));
      }
      
      setActionSuccess('Player added successfully!');
      setNewPlayerName('');
      setNewPlayerBuyIns(1);
      setShowAddPlayerModal(false);
      refreshPlayers();
    } catch (e) {
      console.error('Exception adding player:', e);
      console.error('Exception type:', typeof e);
      console.error('Exception constructor:', e?.constructor?.name);
      setError(`Failed to add player: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    
    setActionLoading(null);
  };
  const refreshPlayers = () => {
    console.log('[refreshPlayers] Starting refresh for session:', sessionId);
    supabase
      .from("session_players")
      .select("*")
      .eq("session_id", sessionId)
      .then(async ({ data, error }) => {
        console.log('[Refresh] Player list:', data, 'Error:', error, 'User ID:', user?.id, 'Player IDs:', data?.map((p: any) => p.user_id));
        if (data && data.length > 0) {
          // Filter out manually added players (manual_ prefix) for profile lookup
          const realUserIds = data.filter((p: any) => !p.user_id.startsWith('manual_')).map((p: any) => p.user_id);
          console.log('[Refresh] Real user IDs for profile lookup:', realUserIds);
          
          let profiles: any[] = [];
          if (realUserIds.length > 0) {
            const { data: profileData, error: profileError } = await supabase
              .from("profile")
              .select("id,first_name,last_name")
              .in("id", realUserIds);
            profiles = profileData || [];
            console.log('[Refresh] Profiles found:', profiles);
          }
          
          const playersWithNames = data.map((p: any) => {
            // For manually added players, don't look for profile
            if (p.user_id.startsWith('manual_')) {
              console.log('[Refresh] Processing manually added player:', p.user_id);
              return { ...p, profile: null };
            }
            const profile = profiles?.find((pr: any) => pr.id === p.user_id);
            return { ...p, profile };
          });
          console.log('[Refresh] Final players with names:', playersWithNames);
          setPlayers(playersWithNames);
        } else {
          console.log('[Refresh] No players found, setting empty array');
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
        net = payout - (p.buy_ins || 0) * (p.buy_in_amount || buyInAmount);
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
  
  // Add player modal functions
  const openAddPlayerModal = () => { 
    setNewPlayerName(''); 
    setNewPlayerBuyIns(1); 
    setShowAddPlayerModal(true); 
  };
  const closeAddPlayerModal = () => {
    setShowAddPlayerModal(false);
  };

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
    if (!window.confirm('Are you sure you want to save these changes? This will update all player values.')) return;
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

  // Calculate average stack and alive players for display
  const alivePlayers = players.filter((p) => p.status !== "eliminated");
  const totalChips = players.reduce(
    (sum, p) => sum + (p.buy_ins || 0) * (session?.settings?.startingChips || 10000),
    0
  );
  const avgStack = alivePlayers.length > 0 ? Math.round(totalChips / alivePlayers.length) : 0;

  return (
    <div className="flex flex-col gap-8 bg-black min-h-screen text-white p-4">
      {/* Room Code Display - subtle, above main clock */}
      <div className="w-full text-center text-sm text-red-300 font-mono tracking-widest mb-2">
        Room Code: {room?.code || "..."}
      </div>
      {/* Top: Current Level and Time Remaining */}
      <section className="mx-auto w-full max-w-xl rounded-2xl border-4 border-red-600 bg-gradient-to-br from-black via-red-900 to-black shadow-lg p-8 flex flex-col items-center mb-2 mt-2">
        <div className="text-lg uppercase tracking-widest text-red-400 mb-2">
          Level {currentLevel + 1}
        </div>
        <div className="text-6xl font-mono font-bold text-white mb-4 drop-shadow-lg">
          <Clock
            running={clock.running}
            timeLeft={clock.timeLeft}
            currentLevel={currentLevel}
            blindLevels={blindLevels}
          />
        </div>
        {admin && (
          <div className="flex flex-col gap-2 mt-2 items-center">
            <div className="flex gap-2">
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleStart} disabled={clock.running}>Start</button>
              <button className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handlePause} disabled={!clock.running}>Pause</button>
              <button className="bg-red-700 hover:bg-red-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleReset}>Reset</button>
              <button className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleNextLevel}>Next Level</button>
              <button className="bg-red-900 hover:bg-red-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={handleEndSession} disabled={ending}>
                {ending ? "Ending..." : "End Session"}
              </button>
            </div>
            {/* Subtle Set Level Button and Popover */}
            <SetLevelPopover
              currentLevel={currentLevel}
              blindLevels={blindLevels}
              onSetLevel={async (newLevel) => {
                setCurrentLevel(newLevel);
                setClock({ running: false, timeLeft: blindLevels[newLevel].duration });
                await updateTournamentState({ running: false, timeLeft: blindLevels[newLevel].duration }, newLevel, blindLevels);
              }}
            />
          </div>
        )}
        {blindLevels[currentLevel] && (
          <>
            <div className="text-2xl font-semibold text-red-300 mb-1">
              Blinds: {blindLevels[currentLevel].smallBlind} / {blindLevels[currentLevel].bigBlind}
            </div>
            <div className="text-xl font-semibold text-yellow-400 mb-1">
              Ante: {blindLevels[currentLevel].bigBlind}
            </div>
            <div className="flex flex-row gap-8 text-lg font-semibold text-white mb-2">
              <div>Average Stack: {avgStack}</div>
              <div>Players Remaining: {alivePlayers.length}</div>
            </div>
          </>
        )}
      </section>
      {loading || !session ? (
        <div>Loading...</div>
      ) : session.type === "tournament" ? (
        <>
          {/* Payouts */}
          <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Payouts</h2>
            <PayoutTable prizePool={prizePool} payoutsCount={session?.settings?.payoutsCount || 3} />
          </section>
          {/* Buy-Ins & Players */}
          <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Buy-Ins & Players</h2>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">Players</h2>
              <div className="mb-2 text-green-600 font-bold">Prize Pool: ${prizePool}</div>
              {players.length === 0 ? (
                <div className="text-gray-400">No players yet.</div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {players.map((p) => (
                    <li key={p.id} className="bg-zinc-900 border border-zinc-700 rounded px-4 py-2 flex items-center gap-4">
                      <span className="font-bold text-white">
                        {manualPlayerNames[p.user_id] 
                          ? manualPlayerNames[p.user_id]
                          : (p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.users?.email || p.user_id)
                        }
                      </span>
                      <span className="text-xs text-gray-400">Buy-ins: <span className="text-white">{p.buy_ins || 0}</span></span>
                      <span className={`text-xs font-bold ${p.status === "eliminated" ? "text-gray-400" : "text-green-600"}`}>
                        {p.status === "eliminated" ? "Eliminated" : "Active"}
                      </span>
                      {admin && p.status !== "eliminated" && (
                        <button className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs" onClick={() => handleEliminate(p.user_id)}>
                          Eliminate
                        </button>
                      )}
                      {admin && p.status === "eliminated" && (
                        <button className="bg-green-700 hover:bg-green-800 text-white rounded px-2 py-1 text-xs" onClick={() => handleRevive(p.user_id)}>
                          Revive
                        </button>
                      )}
                      {admin && (
                        <>
                          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 text-xs" onClick={() => handleBuyIn(p.user_id)}>
                            Buy-in
                          </button>
                          <button className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs" onClick={() => handleSubtractBuyIn(p.user_id)}>
                            Subtract Buy-in
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {winner && (
                <div className="mt-4 text-2xl font-bold text-yellow-500">
                  Winner: {manualPlayerNames[winner.user_id] 
                    ? manualPlayerNames[winner.user_id]
                    : (winner.profile?.first_name && winner.profile?.last_name ? `${winner.profile.first_name} ${winner.profile.last_name}` : winner.users?.email || winner.user_id)
                  } 🎉
                </div>
              )}
            </div>
            {!isPlayer && (
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow mb-4" onClick={handleJoin} disabled={joining}>
                {joining ? "Joining..." : "Join Session"}
              </button>
            )}
            {admin && (
              <button className="bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-6 rounded shadow mb-4 ml-2" onClick={openAddPlayerModal} disabled={actionLoading === 'addplayer'}>
                {actionLoading === 'addplayer' ? "Adding..." : "Add Player"}
              </button>
            )}
            
            {error && <div className="text-red-600 text-sm text-center mb-2">{error}</div>}
            {actionSuccess && <div className="text-green-600 text-sm text-center mb-2">{actionSuccess}</div>}
          </section>
          {/* Blind Levels List */}
          <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Blind Levels</h2>
            <BlindLevelList />
          </section>
        </>
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
                  <li key={p.id} className={`bg-zinc-900 border border-zinc-700 rounded px-4 py-2 flex items-center gap-4 ${p.user_id === user.id ? 'ring-2 ring-blue-500' : ''}`}>
                    <span className="font-bold text-white">{manualPlayerNames[p.user_id] 
                      ? manualPlayerNames[p.user_id]
                      : (p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.users?.email || p.user_id)
                    }</span>
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
                        <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 text-xs ml-2" onClick={openBuyInModal} disabled={actionLoading === 'buyin'}>Buy-in</button>
                        <button className="bg-blue-700 text-white rounded px-2 py-1 text-xs ml-1" onClick={openCashOutModal} disabled={actionLoading === 'cashout'}>Cash Out</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {winner && (
              <div className="mt-4 text-2xl font-bold text-yellow-500">
                Winner: {manualPlayerNames[winner.user_id] 
                  ? manualPlayerNames[winner.user_id]
                  : (winner.profile?.first_name && winner.profile?.last_name ? `${winner.profile.first_name} ${winner.profile.last_name}` : winner.users?.email || winner.user_id)
                } 🎉
              </div>
            )}
          </div>
          {!isPlayer && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow mb-4" onClick={handleJoin} disabled={joining}>
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
                    <span className="font-semibold text-white">{manualPlayerNames[p.user_id] 
                      ? manualPlayerNames[p.user_id]
                      : (p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.users?.email || p.user_id)
                    }</span>
                    <span className={`ml-auto font-mono font-bold ${getNet(p) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{getNet(p) >= 0 ? '+' : ''}${getNet(p)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Modals - Available for both tournament and cash games */}
      {showBuyInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl flex flex-col gap-6 border border-zinc-700 w-full max-w-sm">
            <h2 className="text-2xl font-bold text-white mb-2">Buy-In</h2>
            <p className="text-white text-sm mb-2">Enter your buy-in amount below. This is the amount you are buying in for this cash game session.</p>
            <input
              type="number"
              min="1"
              step="0.01"
              className="border border-zinc-700 rounded px-3 py-2 bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={buyInAmountInput}
              onChange={e => setBuyInAmountInput(e.target.value)}
              placeholder="Buy-in amount"
              aria-label="Buy-in amount"
              autoFocus
            />
            <div className="flex gap-4 justify-end">
              <button className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-bold" onClick={handleBuyInSubmit} disabled={actionLoading === 'buyin'}>
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
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-8 rounded-xl shadow-2xl flex flex-col gap-6 border border-zinc-700 w-full max-w-sm">
            <h2 className="text-2xl font-bold text-green-400">Add Player</h2>
            <p className="text-white text-sm">Add a player who couldn't sign in to the tournament. They will be added with the specified number of buy-ins.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Player Name</label>
                <input
                  type="text"
                  className="border border-zinc-700 rounded px-3 py-2 bg-zinc-800 text-white w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  placeholder="Enter player name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Initial Buy-ins</label>
                <input
                  type="number"
                  min="1"
                  className="border border-zinc-700 rounded px-3 py-2 bg-zinc-800 text-white w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={newPlayerBuyIns}
                  onChange={e => setNewPlayerBuyIns(Number(e.target.value))}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="flex gap-4 justify-end">
              <button className="bg-green-700 hover:bg-green-800 text-white rounded px-4 py-2 font-bold" onClick={handleAddPlayer} disabled={actionLoading === 'addplayer'}>
                {actionLoading === 'addplayer' ? 'Adding...' : 'Add Player'}
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2 font-bold" onClick={closeAddPlayerModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 