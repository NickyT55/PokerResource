import React, { useState } from "react";
import { useTournamentStore } from "@/store/tournament";
import { Player } from "@/types/tournament";
import { v4 as uuidv4 } from "uuid";

const BuyInForm = () => {
  const players = useTournamentStore((s) => s.players);
  const addPlayer = useTournamentStore((s) => s.addPlayer);
  const addBuyIn = useTournamentStore((s) => s.addBuyIn);
  const addRebuy = useTournamentStore((s) => s.addRebuy);
  const recalculatePrizePool = useTournamentStore((s) => s.recalculatePrizePool);
  const buyInAmount = useTournamentStore((s) => s.settings.buyInAmount);
  const setPlayers = useTournamentStore((s) => s.setPlayers);

  const [name, setName] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const handleAddPlayer = () => {
    if (name.trim()) {
      addPlayer({ id: uuidv4(), name: name.trim(), buyIns: 1, rebuys: 0, status: "alive", notes: "" });
      setName("");
      recalculatePrizePool();
    }
  };

  const handleBuyIn = (id: string) => {
    addBuyIn(id);
    recalculatePrizePool();
  };

  const handleRebuy = (id: string) => {
    addRebuy(id);
    recalculatePrizePool();
  };

  const handleMinusRebuy = (id: string) => {
    setPlayers(players.map((p) =>
      p.id === id && p.rebuys > 0 ? { ...p, rebuys: p.rebuys - 1 } : p
    ));
    recalculatePrizePool();
  };

  const handleToggleEliminated = (id: string) => {
    setPlayers(players.map((p) =>
      p.id === id ? { ...p, status: p.status === "eliminated" ? "alive" : "eliminated" } : p
    ));
  };

  const handleEditNote = (id: string, current: string) => {
    setEditingNote(id);
    setNoteValue(current || "");
  };

  const handleSaveNote = (id: string) => {
    setPlayers(players.map((p) =>
      p.id === id ? { ...p, notes: noteValue } : p
    ));
    setEditingNote(null);
    setNoteValue("");
  };

  const totalEntries = players.reduce((sum, p) => sum + p.buyIns, 0);
  const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
  const totalPrizePool = players.reduce((sum, p) => sum + (p.buyIns + p.rebuys) * buyInAmount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
          placeholder="Player Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="bg-red-700 hover:bg-red-800 text-white font-bold px-4 py-2 rounded shadow"
          onClick={handleAddPlayer}
        >
          Add Player
        </button>
      </div>
      <table className="w-full text-center bg-black/60 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-red-900/80 text-white">
            <th className="py-2">Name</th>
            <th className="py-2">Buy-Ins</th>
            <th className="py-2">Rebuys</th>
            <th className="py-2">Status</th>
            <th className="py-2">Notes</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-b border-red-900/40">
              <td className="py-1 text-red-300 font-bold">{player.name}</td>
              <td>{player.buyIns}</td>
              <td>{player.rebuys}</td>
              <td className={player.status === "eliminated" ? "text-gray-400" : "text-green-400 font-bold"}>
                {player.status === "eliminated" ? "Eliminated" : "Alive"}
              </td>
              <td>
                {editingNote === player.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="rounded bg-neutral-800 text-white border border-neutral-700 px-2 py-1"
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="bg-green-700 hover:bg-green-800 text-white rounded px-2 py-1 text-xs"
                      onClick={() => handleSaveNote(player.id)}
                    >
                      Save
                    </button>
                    <button
                      className="bg-gray-700 hover:bg-gray-800 text-white rounded px-2 py-1 text-xs"
                      onClick={() => setEditingNote(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    {player.notes || <span className="text-gray-400">—</span>}
                    <button
                      className="bg-neutral-700 hover:bg-neutral-800 text-white rounded px-2 py-1 text-xs ml-2"
                      onClick={() => handleEditNote(player.id, player.notes || "")}
                      title="Edit Note"
                    >
                      ✎
                    </button>
                  </span>
                )}
              </td>
              <td className="flex gap-2 justify-center items-center py-1">
                <button
                  className="bg-green-700 hover:bg-green-800 text-white rounded px-2 py-1 text-xs"
                  onClick={() => handleBuyIn(player.id)}
                  title="Add Buy-In"
                >
                  + Buy-In
                </button>
                <button
                  className="bg-yellow-600 hover:bg-yellow-700 text-white rounded px-2 py-1 text-xs"
                  onClick={() => handleRebuy(player.id)}
                  title="Add Rebuy"
                >
                  + Rebuy
                </button>
                <button
                  className="bg-yellow-900 hover:bg-yellow-800 text-white rounded px-2 py-1 text-xs"
                  onClick={() => handleMinusRebuy(player.id)}
                  title="- Rebuy"
                  disabled={player.rebuys === 0}
                >
                  - Rebuy
                </button>
                <button
                  className={
                    player.status === "eliminated"
                      ? "bg-gray-700 hover:bg-gray-800 text-white rounded px-2 py-1 text-xs"
                      : "bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs"
                  }
                  onClick={() => handleToggleEliminated(player.id)}
                  title={player.status === "eliminated" ? "Mark as Alive" : "Mark as Eliminated"}
                >
                  {player.status === "eliminated" ? "Revive" : "Eliminate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-8 mt-2 text-lg text-red-200 font-semibold">
        <div>Total Entries: {totalEntries}</div>
        <div>Total Rebuys: {totalRebuys}</div>
        <div>Prize Pool: ${totalPrizePool}</div>
      </div>
    </div>
  );
};

export default BuyInForm; 