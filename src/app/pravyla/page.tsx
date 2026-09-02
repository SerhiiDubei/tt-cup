import { redirect } from 'next/navigation';

/**
 * Сторінка знята: у ній лишався серпневий цикл, а зміст переїхав у /yak.
 * Редірект, а не видалення, — щоб старі посилання не давали 404.
 */
export default function LegacyPage() {
  redirect('/yak');
}
