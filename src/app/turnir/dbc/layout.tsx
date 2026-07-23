import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мій турнір — DRUID BATTLE CUP',
  description: 'Кабінет учасника: заявка, оплата, жеребкування 2.08, матчі ліги.',
};

export default function TurnirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
