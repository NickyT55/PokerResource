export function calculatePayouts(prizePool: number, winners: number): number[] {
  // Simple payout structure: 1st 50%, 2nd 30%, 3rd 20%
  const splits = [0.5, 0.3, 0.2];
  return splits.slice(0, winners).map(split => Math.round(prizePool * split));
} 