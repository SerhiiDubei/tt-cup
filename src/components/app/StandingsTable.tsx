import type { Match, Player } from '@/lib/tournament/types';
import { computeStandings } from '@/lib/tournament/standings';

const QUALIFY_COUNT = 8;

/** First letter of a name, uppercased, for the avatar bubble. */
function initialOf(name: string | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/**
 * Render the swiss standings (via {@link computeStandings}) as a `.tbl`.
 *
 * Columns: # / ГРАВЕЦЬ (hero-coloured initial avatar + name + @nick) / W–L /
 * GD / BCH / PTS. When `qualify` is true the top-{@link QUALIFY_COUNT} rows are
 * marked with the `q` class (green qualifying zone).
 */
export default function StandingsTable({
  players,
  matches,
  qualify,
}: {
  players: Player[];
  matches: Match[];
  qualify: boolean;
}) {
  const standings = computeStandings(players, matches);

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 48 }}>#</th>
          <th>Гравець</th>
          <th style={{ textAlign: 'center' }}>W–L</th>
          <th style={{ textAlign: 'center' }}>GD</th>
          <th style={{ textAlign: 'center' }}>BCH</th>
          <th style={{ textAlign: 'center' }}>PTS</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row, i) => {
          const q = qualify && i < QUALIFY_COUNT;
          const color = row.player.hero?.color || 'var(--yellow)';
          return (
            <tr key={row.id} className={q ? 'q' : undefined}>
              <td className="pts">{i + 1}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      flexShrink: 0,
                      border: '3px solid var(--line)',
                      borderRadius: 11,
                      display: 'grid',
                      placeItems: 'center',
                      background: color,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    {initialOf(row.player.name)}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontWeight: 700 }}>{row.player.name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)' }}>
                      @{row.player.nickname}
                    </span>
                  </span>
                </div>
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.wins}–{row.losses}
              </td>
              <td style={{ textAlign: 'center' }}>
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </td>
              <td style={{ textAlign: 'center' }}>{row.buchholz}</td>
              <td className="pts" style={{ textAlign: 'center' }}>
                {row.points}
              </td>
            </tr>
          );
        })}
        {standings.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              Поки немає гравців
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
