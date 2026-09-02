import { redirect } from 'next/navigation';

/**
 * Старий кабінет замінено на /kabinet/[token].
 * Причина: у ньому лишались зашиті дати минулого циклу («жеребкування 2.08»,
 * «фінали 23 серпня»), які бачили вже зареєстровані люди. Два кабінети —
 * два джерела правди; лишаємо одне. Стара реалізація — page.legacy.tsx.bak.
 */
export default async function LegacyCabinet({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/kabinet/${token}`);
}
