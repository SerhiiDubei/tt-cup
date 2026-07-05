import FormatExplainer from '@/components/landing/FormatExplainer';
import Faq from '@/components/landing/Faq';

export const metadata = { title: 'Як грати — КУБОК' };

export default function HowPage() {
  return (
    <main>
      <FormatExplainer />
      <Faq />
    </main>
  );
}
