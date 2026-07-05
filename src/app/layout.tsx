import type { Metadata } from 'next';
import './globals.css';
import { BRAND } from '@/config';

export const metadata: Metadata = {
  title: `${BRAND} — турнір з настільного тенісу`,
  description: 'Створи героя, грай швейцарку у 8 турів і пробийся у топ-8 офлайн плей-офф.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500;600;700;800;900&family=Onest:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
