import React from "react";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface ClockProps {
  running: boolean;
  timeLeft: number;
  currentLevel: number;
  blindLevels: any[];
  breakLevels?: number[];
  onBreak?: boolean;
  breakTime?: number;
}

const Clock: React.FC<ClockProps> = ({
  running,
  timeLeft,
  currentLevel,
  blindLevels,
  breakLevels = [],
  onBreak = false,
  breakTime = 0,
}) => {
  return (
    <div className="flex flex-col items-center gap-4">
      {onBreak ? (
        <>
          <div className="text-5xl font-mono font-bold tracking-widest drop-shadow-lg text-yellow-300 mb-2">Break in progress</div>
          <div className="text-7xl font-mono font-bold tracking-widest drop-shadow-lg text-yellow-200">
            {formatTime(breakTime)}
          </div>
        </>
      ) : (
        <>
          <div className="text-7xl font-mono font-bold tracking-widest drop-shadow-lg">
            {formatTime(timeLeft)}
          </div>
        </>
      )}
    </div>
  );
};

export default Clock; 