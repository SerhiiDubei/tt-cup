import type { Metadata } from 'next';
import { ScrollRoot } from '@/components/v3/Scroll';
import Story from '@/components/v3/Story';
import V3Ui from '@/components/v3/V3Ui';
import '../v2/v2.css';
import './v3.css';

export const metadata: Metadata = {
  title: 'DRUID BATTLE CUP — скрол-історія',
  description: 'Гортай — розкажемо, як працює турнір: ліга два тижні, день Х, міні-ігри.',
};

export default function Page() {
  return (
    <ScrollRoot>
      <main className="v3-root">
        <Story />
        <V3Ui />
      </main>
    </ScrollRoot>
  );
}
