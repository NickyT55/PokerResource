import { create } from 'zustand';
import { TournamentState, Player, BlindLevel, Settings, TournamentHistoryEntry } from '../types/tournament';

const STORAGE_KEY = 'tournament_state';
const HISTORY_KEY = 'tournament_history';

const defaultSettings: Settings = {
  defaultBlindDuration: 900, // 15 min
  startingChips: 10000,
  buyInAmount: 100,
  payoutsCount: 3,
};

const defaultBlindLevels: BlindLevel[] = [
  { id: '1', smallBlind: 25, bigBlind: 50, duration: 900 },
  { id: '2', smallBlind: 50, bigBlind: 100, duration: 900 },
  { id: '3', smallBlind: 75, bigBlind: 150, duration: 900 },
];

const initialState: TournamentState & { tournamentOver?: boolean } = {
  players: [],
  blindLevels: defaultBlindLevels,
  currentLevel: 0,
  clock: {
    running: false,
    timeLeft: defaultSettings.defaultBlindDuration,
  },
  settings: defaultSettings,
  prizePool: 0,
  payouts: [],
  tournamentOver: false,
};

function loadState(): TournamentState {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...initialState, ...JSON.parse(saved) };
      } catch {}
    }
  }
  return initialState;
}

export const useTournamentStore = create<
  TournamentState & {
    tournamentOver: boolean;
    addPlayer: (player: Player) => void;
    addBuyIn: (playerId: string) => void;
    addRebuy: (playerId: string) => void;
    setBlindLevels: (levels: BlindLevel[]) => void;
    setPlayers: (players: Player[]) => void;
    setCurrentLevel: (level: number) => void;
    setClock: (running: boolean, timeLeft?: number) => void;
    setSettings: (settings: Settings) => void;
    setPayouts: (payouts: number[]) => void;
    recalculatePrizePool: () => void;
    resetTournament: () => void;
    setTournamentOver: (over: boolean) => void;
    saveTournamentToHistory: () => void;
  }
>((set, get) => {
  // Load from localStorage on init
  let state = typeof window !== 'undefined' ? loadState() : initialState;

  // Save to localStorage on every change
  const persist = (nextState: Partial<TournamentState>) => {
    const fullState = { ...get(), ...nextState };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState));
    }
    return fullState;
  };

  return {
    ...state,
    tournamentOver: false,
    addPlayer: (player) => set((s) => persist({ players: [...s.players, player] })),
    addBuyIn: (playerId) => set((s) =>
      persist({
        players: s.players.map(p => p.id === playerId ? { ...p, buyIns: p.buyIns + 1 } : p)
      })
    ),
    addRebuy: (playerId) => set((s) =>
      persist({
        players: s.players.map(p => p.id === playerId ? { ...p, rebuys: p.rebuys + 1 } : p)
      })
    ),
    setBlindLevels: (levels) => set((s) => persist({ blindLevels: levels })),
    setPlayers: (players) => set((s) => persist({ players })),
    setCurrentLevel: (level) => set((s) => persist({ currentLevel: level })),
    setClock: (running, timeLeft) => set((s) =>
      persist({
        clock: {
          running,
          timeLeft: timeLeft !== undefined ? timeLeft : s.clock.timeLeft,
        },
      })
    ),
    setSettings: (settings) => set((s) => persist({ settings })),
    setPayouts: (payouts) => set((s) => persist({ payouts })),
    recalculatePrizePool: () => set((s) => {
      const prizePool = s.players.reduce(
        (sum, p) => sum + (p.buyIns + p.rebuys) * s.settings.buyInAmount,
        0
      );
      return persist({ prizePool });
    }),
    resetTournament: () => set(() => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      return { ...initialState, tournamentOver: false };
    }),
    setTournamentOver: (over) => set((s) => persist({ tournamentOver: over })),
    saveTournamentToHistory: () => {
      const s = get();
      const winner = s.players.find((p) => p.status !== 'eliminated');
      const entry: TournamentHistoryEntry = {
        id: `${Date.now()}`,
        date: new Date().toISOString(),
        winner: winner ? winner.name : '',
        players: s.players,
        payouts: s.payouts,
        settings: s.settings,
      };
      if (typeof window !== 'undefined') {
        const prev = localStorage.getItem(HISTORY_KEY);
        const arr = prev ? JSON.parse(prev) : [];
        arr.unshift(entry);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
      }
    },
  };
}); 