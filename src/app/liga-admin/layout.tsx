import type { Metadata } from 'next';
import '../liga.css';

export const metadata: Metadata = {
  title: 'Оплати — DRUID BATTLE CUP',
  robots: { index: false },
};

export default function LigaAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
