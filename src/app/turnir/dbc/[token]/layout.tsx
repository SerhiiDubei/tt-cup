import type { Metadata } from 'next';
import '../../../liga.css';

export const metadata: Metadata = {
  title: 'Мій турнір — DRUID BATTLE CUP',
  description: 'Статус оплати, рівень і матчі ліги.',
};

export default function YaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
