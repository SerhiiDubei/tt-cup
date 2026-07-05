// сайтовий хром (прелоадер/курсор/нав/футер) — тільки для сторінок сайту, не для кіоска
import Chrome from '@/components/chrome/Chrome';
import Nav from '@/components/chrome/Nav';
import Footer from '@/components/chrome/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Chrome />
      <Nav />
      {children}
      <Footer />
    </>
  );
}
