"use client";
import React, { useEffect, useState } from "react";
import { calculatePayouts } from "@/lib/payouts";

interface PayoutTableProps {
  prizePool: number;
  payoutsCount: number;
}

const PayoutTable = ({ prizePool, payoutsCount }: PayoutTableProps) => {
  const [manual, setManual] = useState(false);
  const [manualPayouts, setManualPayouts] = useState<number[]>(() => calculatePayouts(prizePool, payoutsCount));

  // Auto-calculate payouts when not in manual mode
  useEffect(() => {
    if (!manual) {
      setManualPayouts(calculatePayouts(prizePool, payoutsCount));
    }
  }, [prizePool, payoutsCount, manual]);

  const handleManualChange = (i: number, value: number) => {
    const updated = [...manualPayouts];
    updated[i] = value;
    setManualPayouts(updated);
  };

  const handleManualToggle = () => {
    setManual((m) => !m);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center mb-2">
        <label className="text-red-200 font-semibold">
          <input
            type="checkbox"
            checked={manual}
            onChange={handleManualToggle}
            className="mr-2 accent-red-700"
          />
          Edit payouts manually
        </label>
      </div>
      <table className="w-full text-center bg-black/60 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-red-900/80 text-white">
            <th className="py-2">Place</th>
            <th className="py-2">Payout</th>
          </tr>
        </thead>
        <tbody>
          {manualPayouts.map((amt, i) => (
            <tr key={i} className="border-b border-red-900/40">
              <td className="py-1 text-red-300 font-bold">{i + 1}</td>
              <td>
                {manual ? (
                  <input
                    type="number"
                    className="w-24 text-center rounded bg-neutral-800 text-white border border-neutral-700"
                    value={amt}
                    min={0}
                    onChange={(e) => handleManualChange(i, Number(e.target.value))}
                  />
                ) : (
                  <span>${amt}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right text-red-200 font-semibold mt-2">
        Total: ${manualPayouts.reduce((sum, v) => sum + v, 0)}
      </div>
    </div>
  );
};

export default PayoutTable; 