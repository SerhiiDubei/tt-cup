import type { Metadata } from 'next';
import '../liga.css';

export const metadata: Metadata = {
  title: 'Реєстрація — DRUID BATTLE CUP',
  description: 'Ліга 9–12 вересня на ДРУЇДІ + День Х 13 вересня з фіналами і міні-іграми. Вписуйся.',
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
