export interface Player {
  id: string;
  name: string;
  buyIns: number;
  rebuys: number;
  status?: 'alive' | 'eliminated'; // default is 'alive'
  notes?: string;
}

export interface BlindLevel {
  id: string;
  smallBlind: number;
  bigBlind: number;
  duration: number; // in seconds
}

export interface Settings {
  defaultBlindDuration: number;
  breakLevels: number[];
  startingChips: number;
  buyInAmount: number;
  payoutsCount: number;
}

export interface TournamentState {
  players: Player[];
  blindLevels: BlindLevel[];
  currentLevel: number;
  clock: {
    running: boolean;
    timeLeft: number;
  };
  settings: Settings;
  prizePool: number;
  payouts: number[];
  tournamentOver: boolean;
}

export interface TournamentHistoryEntry {
  id: string;
  date: string;
  winner: string;
  players: Player[];
  payouts: number[];
  settings: Settings;
} 