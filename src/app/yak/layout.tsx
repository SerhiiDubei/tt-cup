import type { Metadata } from 'next';
import '../kabinet/[token]/kabinet.css';
import './yak.css';
import '../(merchant)/merchant.css';

export const metadata: Metadata = {
  title: 'Як усе влаштовано · DRUID BATTLE CUP',
  description: 'Реєстрація до 15 вересня, матчі 16–18, фінали 19 вересня на Друїді. Коротко і без води.',
};

export default function YakLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
