"use client";

import React, { useState } from "react";
import { useTournamentStore } from "@/store/tournament";
import { v4 as uuidv4 } from "uuid";

const BlindLevelList = () => {
  const blindLevels = useTournamentStore((s) => s.blindLevels);
  const setBlindLevels = useTournamentStore((s) => s.setBlindLevels);

  const [editMode, setEditMode] = useState(false);
  const [editedLevels, setEditedLevels] = useState(() => blindLevels.map(l => ({ ...l })));
  const isSavingRef = React.useRef(false);

  // Sync editedLevels with store if blinds change externally
  React.useEffect(() => {
    // Don't sync if we're currently saving (prevents infinite loop)
    if (isSavingRef.current) return;
    
    setEditedLevels(blindLevels.map(l => ({ ...l })));
  }, [blindLevels]);

  const handleEdit = (i: number, field: "smallBlind" | "bigBlind" | "duration", value: number) => {
    setEditedLevels(levels => levels.map((l, idx) =>
      idx === i ? { ...l, [field]: value } : l
    ));
  };

  const handleSave = () => {
    isSavingRef.current = true;
    // Ensure ante matches big blind
    setBlindLevels(editedLevels.map(l => ({ ...l, bigBlind: l.bigBlind })));
    setEditMode(false);
    // Reset saving flag after a short delay to allow the store update to complete
    setTimeout(() => {
      isSavingRef.current = false;
    }, 100);
  };

  const handleAddLevel = () => {
    setEditedLevels(levels => [
      ...levels,
      {
        id: uuidv4(),
        smallBlind: 50,
        bigBlind: 100,
        duration: 900,
      },
    ]);
  };

  const handleRemoveLevel = (i: number) => {
    setEditedLevels(levels => levels.filter((_, idx) => idx !== i));
  };

  const moveLevel = (index: number, direction: -1 | 1) => {
    setEditedLevels(levels => {
      const newLevels = [...levels];
      const target = index + direction;
      if (target < 0 || target >= newLevels.length) return newLevels;
      [newLevels[index], newLevels[target]] = [newLevels[target], newLevels[index]];
      return newLevels;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 mb-2">
        <button
          className={`px-4 py-2 rounded font-bold shadow ${editMode ? "bg-green-700 hover:bg-green-800" : "bg-red-700 hover:bg-red-800"} text-white`}
          onClick={() => setEditMode(e => !e)}
        >
          {editMode ? "Cancel" : "Edit Blinds"}
        </button>
        {editMode && (
          <>
            <button
              className="px-4 py-2 rounded font-bold shadow bg-green-700 hover:bg-green-800 text-white"
              onClick={handleSave}
            >
              Save Blinds
            </button>
            <button
              className="px-4 py-2 rounded font-bold shadow bg-blue-700 hover:bg-blue-800 text-white"
              onClick={handleAddLevel}
            >
              Add Level
            </button>
          </>
        )}
      </div>
      <table className="w-full text-center bg-black/60 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-red-900/80 text-white">
            <th className="py-2">Level</th>
            <th className="py-2">Small Blind</th>
            <th className="py-2">Big Blind</th>
            <th className="py-2">Ante</th>
            <th className="py-2">Duration (min)</th>

            {editMode && <th className="py-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {(editMode ? editedLevels : blindLevels).map((level, i) => (
            <tr key={level.id} className="border-b border-red-900/40">
              <td className="py-1 text-red-300 font-bold">{i + 1}</td>
              <td>
                {editMode ? (
                  <input
                    type="number"
                    className="w-16 text-center rounded bg-neutral-800 text-white border border-neutral-700"
                    value={level.smallBlind}
                    min={0}
                    step={50}
                    onChange={e => handleEdit(i, "smallBlind", Number(e.target.value))}
                  />
                ) : (
                  level.smallBlind
                )}
              </td>
              <td>
                {editMode ? (
                  <input
                    type="number"
                    className="w-16 text-center rounded bg-neutral-800 text-white border border-neutral-700"
                    value={level.bigBlind}
                    min={0}
                    step={50}
                    onChange={e => handleEdit(i, "bigBlind", Number(e.target.value))}
                  />
                ) : (
                  level.bigBlind
                )}
              </td>
              <td>{level.bigBlind}</td>
              <td>
                {editMode ? (
                  <input
                    type="number"
                    className="w-16 text-center rounded bg-neutral-800 text-white border border-neutral-700"
                    value={level.duration / 60}
                    min={1}
                    onChange={e => handleEdit(i, "duration", Number(e.target.value) * 60)}
                  />
                ) : (
                  level.duration / 60
                )}
              </td>
                
              {editMode && (
                <td className="flex gap-2 justify-center items-center py-1">
                  <button
                    className="bg-red-700 hover:bg-red-800 text-white rounded px-2 py-1 text-xs"
                    onClick={() => handleRemoveLevel(i)}
                    title="Remove"
                  >
                    ✕
                  </button>
                  <button
                    className="bg-neutral-700 hover:bg-neutral-800 text-white rounded px-2 py-1 text-xs"
                    onClick={() => moveLevel(i, -1)}
                    disabled={i === 0}
                    title="Move Up"
                  >
                    ↑
                  </button>
                  <button
                    className="bg-neutral-700 hover:bg-neutral-800 text-white rounded px-2 py-1 text-xs"
                    onClick={() => moveLevel(i, 1)}
                    disabled={i === (editMode ? editedLevels.length : blindLevels.length) - 1}
                    title="Move Down"
                  >
                    ↓
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BlindLevelList; 