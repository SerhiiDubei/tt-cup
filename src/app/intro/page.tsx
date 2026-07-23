import type { Metadata } from 'next';
import IntroLab from '@/components/intro/IntroLab';
import './intro.css';

export const metadata: Metadata = {
  title: 'Лабораторія інтро — TT CUP',
  description: 'Три варіанти стартової анімації: дощ, удар, ралі. Обираємо найкльовішу.',
};

export default function Page() {
  return <IntroLab />;
}
