import type { Metadata } from 'next';
import '../liga.css';

export const metadata: Metadata = {
  title: 'Реєстрація — DRUID BATTLE CUP',
  description: 'Три тижні ліги (2–23 серпня) на ДРУЇДІ + день Х з фіналами і міні-іграми. Вписуйся.',
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
