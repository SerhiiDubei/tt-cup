import { redirect } from 'next/navigation';

/** Старий URL кабінету → новий (D-044): кабінет учасника живе на /turnir/dbc. */
export default async function YaRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/turnir/dbc/${token}`);
}
