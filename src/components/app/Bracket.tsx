import type { Match, Player } from '@/lib/tournament/types';
import { gamesFromSets } from '@/lib/tournament/scoring';
import { champion, bronze } from '@/lib/tournament/playoff';

/** Look up a player by id within a list. */
function findPlayer(players: Player[], id: string | null | undefined): Player | undefined {
  if (id == null) return undefined;
  return players.find((p) => p.id === id);
}

/** Display name for a player id, with a graceful fallback. */
function nameOf(players: Player[], id: string | null | undefined): string {
  return findPlayer(players, id)?.name ?? '—';
}

/** Playoff rounds in bracket order, with their column headings. */
const COLUMNS: { round: string; heading: string }[] = [
  { round: 'QF', heading: '1/4' },
  { round: 'SF', heading: '1/2' },
  { round: 'F', heading: 'ФІНАЛ' },
  { round: 'BR', heading: 'ЗА 3-ТЄ' },
];

/** Matches of one playoff round, slot-ordered. */
function roundMatches(matches: Match[], round: string): Match[] {
  return matches
    .filter((m) => m.stage === 'playoff' && m.round === round)
    .sort((a, b) => a.slot - b.slot);
}

/** One competitor row inside a `.bmatch`. */
function Br({
  players,
  id,
  seed,
  games,
  isWinner,
}: {
  players: Player[];
  id: string | null | undefined;
  seed: number | null | undefined;
  games: number;
  isWinner: boolean;
}) {
  return (
    <div className={`br${isWinner ? ' w' : ''}`}>
      <span style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {seed != null && <span className="seed">#{seed}</span>}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {nameOf(players, id)}
        </span>
      </span>
      <span className="score-big" style={{ fontSize: 18 }}>
        {games}
      </span>
    </div>
  );
}

/** A single playoff fixture as a `.bmatch` with two `.br` rows. */
function BracketMatch({ players, match }: { players: Player[]; match: Match }) {
  const [gamesA, gamesB] = gamesFromSets(match.sets);
  const reported = match.status === 'reported';
  return (
    <div className="bmatch">
      <Br
        players={players}
        id={match.a}
        seed={match.seed_a}
        games={gamesA}
        isWinner={reported && match.winner === match.a}
      />
      <Br
        players={players}
        id={match.b}
        seed={match.seed_b}
        games={gamesB}
        isWinner={reported && match.winner === match.b}
      />
    </div>
  );
}

/**
 * Render the top-8 playoff as a `.bracket` of columns (1/4, 1/2, ФІНАЛ, ЗА 3-ТЄ).
 *
 * Only rounds that actually have matches are shown. Each fixture is a `.bmatch`
 * with two `.br` rows (`.w` on the winner, `.seed` prefix for `seed_a`/`seed_b`)
 * and a games tally via {@link gamesFromSets}. When a champion exists a banner
 * is shown above the bracket, with a bronze badge for the third-place winner.
 */
export default function Bracket({
  players,
  matches,
}: {
  players: Player[];
  matches: Match[];
}) {
  const championId = champion(matches);
  const bronzeId = bronze(matches);

  const columns = COLUMNS.map((col) => ({
    ...col,
    fixtures: roundMatches(matches, col.round),
  })).filter((col) => col.fixtures.length > 0);

  return (
    <div>
      {championId && (
        <div
          className="card"
          style={{
            background: 'var(--yellow)',
            marginBottom: 24,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span className="chip win">ЧЕМПІОН</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28 }}>
            {nameOf(players, championId)}
          </span>
          {bronzeId && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span className="chip">БРОНЗА</span>
              <span style={{ fontWeight: 700 }}>{nameOf(players, bronzeId)}</span>
            </span>
          )}
        </div>
      )}

      <div className="bracket">
        {columns.map((col) => (
          <div className="bcol" key={col.round}>
            <h4>{col.heading}</h4>
            {col.fixtures.map((match) => (
              <BracketMatch key={match.id} players={players} match={match} />
            ))}
          </div>
        ))}
        {columns.length === 0 && (
          <p style={{ color: 'var(--ink-soft)' }}>Плей-офф ще не сформовано</p>
        )}
      </div>
    </div>
  );
}
