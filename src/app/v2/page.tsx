import type { Metadata } from 'next';
import OnboardV2 from '@/components/v2/OnboardV2';
import './v2.css';

export const metadata: Metadata = {
  title: 'DRUID BATTLE CUP — що це за двіж',
  description: 'Два тижні ліги, день Х з фіналами і міні-іграми. Тапни — розкажемо, як усе працює.',
};

export default function Page() {
  return <OnboardV2 />;
}
