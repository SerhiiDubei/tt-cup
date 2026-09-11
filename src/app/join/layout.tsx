import type { Metadata } from 'next';
import '../liga.css';

export const metadata: Metadata = {
  title: 'Реєстрація — DRUID BATTLE CUP',
  description: 'Ліга 16–18 вересня на ДРУЇДІ + День Х 19 вересня з фіналами і міні-іграми. Вписуйся.',
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
