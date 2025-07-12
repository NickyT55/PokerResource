import React from "react";
import Clock from "@/components/Clock";
import BlindLevelList from "@/components/BlindLevelList";
import PayoutTable from "@/components/PayoutTable";
import BuyInForm from "@/components/BuyInForm";

interface TournamentDashboardProps {
  session: any;
  players: any[];
  admin: boolean;
  currentLevel: number;
  clock: { running: boolean; timeLeft: number };
  blindLevels: any[];
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onNextLevel: () => void;
  onEliminate: (userId: string) => void;
  onRevive: (userId: string) => void;
  onBuyIn: (userId: string) => void;
  onRebuy: (userId: string) => void;
  winner: any;
  prizePool: number;
  isPlayer: boolean;
  onJoin: () => void;
  joining: boolean;
  error: string | null;
  onEndSession?: () => void;
  ending?: boolean;
}

export default function TournamentDashboard({
  session,
  players,
  admin,
  currentLevel,
  clock,
  blindLevels,
  onStart,
  onPause,
  onReset,
  onNextLevel,
  onEliminate,
  onRevive,
  onBuyIn,
  onRebuy,
  winner,
  prizePool,
  isPlayer,
  onJoin,
  joining,
  error,
  onEndSession,
  ending,
}: TournamentDashboardProps) {
  // Average stack calculation
  const alivePlayers = players.filter((p) => p.status !== "eliminated");
  const totalChips = players.reduce(
    (sum, p) => sum + (p.buy_ins + p.rebuys) * (session?.settings?.startingChips || 10000),
    0
  );
  const avgStack = alivePlayers.length > 0 ? Math.round(totalChips / alivePlayers.length) : 0;

  return (
    <div className="flex flex-col gap-8 bg-black min-h-screen text-white p-4">
      {/* Top: Current Level and Time Remaining */}
      <section className="mx-auto w-full max-w-xl rounded-2xl border-4 border-red-600 bg-gradient-to-br from-black via-red-900 to-black shadow-lg p-8 flex flex-col items-center mb-2">
        <div className="text-lg uppercase tracking-widest text-red-400 mb-2">Level {currentLevel + 1}</div>
        <div className="text-6xl font-mono font-bold text-white mb-4 drop-shadow-lg">
          <Clock
            running={clock.running}
            timeLeft={clock.timeLeft}
            currentLevel={currentLevel}
            blindLevels={blindLevels}
          />
        </div>
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
        {admin && (
          <div className="flex gap-2 mt-2">
            <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={onStart} disabled={clock.running}>Start</button>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={onPause} disabled={!clock.running}>Pause</button>
            <button className="bg-red-700 hover:bg-red-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={onReset}>Reset</button>
            <button className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={onNextLevel}>Next Level</button>
            {onEndSession && (
              <button className="bg-red-900 hover:bg-red-800 text-white font-bold py-1 px-4 rounded shadow text-sm" onClick={onEndSession} disabled={ending}>
                {ending ? "Ending..." : "End Session"}
              </button>
            )}
          </div>
        )}
      </section>
      {/* Payouts */}
      <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
        <h2 className="text-xl font-semibold text-red-400 mb-2">Payouts</h2>
        <PayoutTable prizePool={prizePool} payoutsCount={session?.settings?.payoutsCount || 3} />
      </section>
      {/* Buy-Ins & Players */}
      <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
        <h2 className="text-xl font-semibold text-red-400 mb-2">Buy-Ins & Players</h2>
        {/* You can add a custom buy-in form or player list here using players prop */}
        {/* <BuyInForm /> */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Players</h2>
          <div className="mb-2 text-green-600 font-bold">Prize Pool: ${prizePool}</div>
          {players.length === 0 ? (
            <div className="text-gray-400">No players yet.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li key={p.id} className="bg-card border border-border rounded px-4 py-2 flex items-center gap-4">
                  <span className="font-bold">{p.profile?.first_name && p.profile?.last_name ? `${p.profile.first_name} ${p.profile.last_name}` : p.users?.email || p.user_id}</span>
                  <span className="text-xs text-gray-500">Buy-ins: {p.buy_ins} | Rebuys: {p.rebuys}</span>
                  <span className={`text-xs font-bold ${p.status === "eliminated" ? "text-gray-400" : "text-green-600"}`}>{p.status === "eliminated" ? "Eliminated" : "Active"}</span>
                  {admin && p.status !== "eliminated" && (
                    <button className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs" onClick={() => onEliminate(p.user_id)}>
                      Eliminate
                    </button>
                  )}
                  {admin && p.status === "eliminated" && (
                    <button className="bg-green-700 hover:bg-green-800 text-white rounded px-2 py-1 text-xs" onClick={() => onRevive(p.user_id)}>
                      Revive
                    </button>
                  )}
                  {p.user_id && (
                    <>
                      <button className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs ml-2" onClick={() => onBuyIn(p.user_id)}>
                        Buy-in
                      </button>
                      <button className="bg-accent text-accent-foreground rounded px-2 py-1 text-xs ml-1" onClick={() => onRebuy(p.user_id)}>
                        Rebuy
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {winner && (
            <div className="mt-4 text-2xl font-bold text-yellow-500">Winner: {winner.profile?.first_name && winner.profile?.last_name ? `${winner.profile.first_name} ${winner.profile.last_name}` : winner.users?.email || winner.user_id} 🎉</div>
          )}
        </div>
        {!isPlayer && (
          <button className="bg-primary text-primary-foreground font-bold py-2 px-6 rounded shadow mb-4" onClick={onJoin} disabled={joining}>
            {joining ? "Joining..." : "Join Session"}
          </button>
        )}
        {error && <div className="text-red-600 text-sm text-center mb-2">{error}</div>}
      </section>
      {/* Blind Levels List */}
      <section className="max-w-2xl mx-auto w-full bg-black/80 rounded-xl border border-red-700 shadow p-4 mb-2">
        <h2 className="text-xl font-semibold text-red-400 mb-2">Blind Levels</h2>
        <BlindLevelList />
      </section>
    </div>
  );
} 