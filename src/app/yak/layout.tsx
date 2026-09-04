import type { Metadata } from 'next';
import '../kabinet/[token]/kabinet.css';
import './yak.css';
import '../(merchant)/merchant.css';

export const metadata: Metadata = {
  title: 'Як усе влаштовано · DRUID BATTLE CUP',
  description: 'Реєстрація до 7 вересня, матчі 8–12, фінали 13 вересня на Друїді. Коротко і без води.',
};

export default function YakLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
