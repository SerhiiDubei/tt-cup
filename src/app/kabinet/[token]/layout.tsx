import type { Metadata } from 'next';
import './kabinet.css';

export const metadata: Metadata = {
  title: 'Мій кабінет · DRUID BATTLE CUP',
  description: 'Що робити далі і коли.',
};

export default function KabinetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
