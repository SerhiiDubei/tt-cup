import type { Metadata, Viewport } from 'next';

/**
 * PWA-обгортка кіоска «Стіл» (D-053): iPad додає /table на Початковий екран
 * і відкриває фулскріном без браузера (+ Guided Access = кіоск-режим).
 * Логіки кіоска не торкається — тільки метадані.
 */
export const metadata: Metadata = {
  title: 'TT Cup · Стіл',
  manifest: '/table.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Стіл',
  },
  icons: {
    apple: '/table-icon-180.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16110d',
};

export default function TableLayout({ children }: { children: React.ReactNode }) {
  return children;
}
