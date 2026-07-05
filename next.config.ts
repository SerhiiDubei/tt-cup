import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Кіоск-деплой (окремий Vercel-проєкт зі змінною KIOSK_HOME=1):
  // корінь домену одразу відкриває табло столу
  async redirects() {
    if (!process.env.KIOSK_HOME) return [];
    return [{ source: '/', destination: '/table', permanent: false }];
  },
};

export default nextConfig;
