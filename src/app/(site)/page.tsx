import { loadState } from '@/lib/state';
import Hero from '@/components/landing/Hero';
import LiveStats from '@/components/landing/LiveStats';
import FormatExplainer from '@/components/landing/FormatExplainer';
import BuilderTeaser from '@/components/landing/BuilderTeaser';
import Rules from '@/components/landing/Rules';
import Cta from '@/components/landing/Cta';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { tournament, players } = await loadState();
  const count = players.length;
  const sample = players.find((p) => p.hero?.art) || null;
  return (
    <main>
      <Hero tournament={tournament} count={count} sample={sample} />
      <LiveStats tournament={tournament} count={count} />
      <BuilderTeaser players={players} />
      <Rules />
      <Cta tournament={tournament} />
    </main>
  );
}
