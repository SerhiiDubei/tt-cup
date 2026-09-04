import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Гравці — DRUID BATTLE CUP',
  description: 'Хто вже вписався в лігу 8–12 вересня на ДРУЇДІ.',
};

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
