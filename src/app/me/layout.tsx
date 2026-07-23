import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мій профіль — DRUID BATTLE CUP',
  description: 'Твій акаунт у сервісі TT Cup: профіль, турніри, статистика.',
};

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
