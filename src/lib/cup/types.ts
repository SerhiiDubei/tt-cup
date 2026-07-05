import type { Traits } from '@/lib/avatar';

export type CupPlayer = {
  id: string;        // unique, e.g. 'p1','p2' or random
  name: string;
  traits: Traits;    // for the SVG illustration
  style: string;     // one of STYLES — drives the superpower accent
};

export type Side = 'a' | 'b';
export type Bracket = 'W' | 'L' | 'GF'; // Winners, Losers, Grand Final

export type CupMatch = {
  id: string;                 // e.g. 'W-1-0' (bracket-round-slot)
  bracket: Bracket;
  round: number;              // 1-based round index within its bracket
  slot: number;               // 0-based position within the round
  label: string;              // human label e.g. '1/4', 'Нижня R2', 'ГРАНД-ФІНАЛ'
  a: string | null;           // CupPlayer id, or null = TBD/empty
  b: string | null;
  scoreA: number;             // games won by a
  scoreB: number;             // games won by b
  winner: string | null;      // player id once reported
  status: 'pending' | 'reported';
  // routing graph (precomputed at bracket creation):
  winTo: { matchId: string; side: Side } | null;   // where the WINNER goes (null = this match's winner is champion path end / GF)
  loseTo: { matchId: string; side: Side } | null;  // where the LOSER goes; null = eliminated ('вилетів')
};

export type CupState = {
  id: string;
  name: string;
  createdAt: number;          // epoch ms (pass in; do not call Date.now in pure logic)
  phase: 'setup' | 'running' | 'done';
  players: CupPlayer[];
  matches: CupMatch[];
  championId: string | null;
  runnerUpId: string | null;
};
