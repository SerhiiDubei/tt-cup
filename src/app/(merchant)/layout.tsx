import type { Metadata } from 'next';
import Link from 'next/link';
import '../kabinet/[token]/kabinet.css';
import '../yak/yak.css';
import './merchant.css';

export const metadata: Metadata = {
  title: 'Документи · DRUID BATTLE CUP',
  robots: { index: true, follow: true },
};

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="kb-root"><div className="kb-phone yk">
      {children}
      <nav className="mc-nav">
        <Link href="/oferta">Публічний договір</Link>
        <Link href="/refund">Повернення коштів</Link>
        <Link href="/contacts">Контакти і реквізити</Link>
      </nav>
      <div className="mc-pay">
        <b>VISA</b><span aria-hidden>·</span><b>Mastercard</b>
        <a href="https://www.wayforpay.com" target="_blank" rel="noreferrer">Оплата карткою через WayForPay</a>
        <span>ФОП Дубей С. В. · ІПН 3327100410</span>
      </div>
    </div></div>
  );
}
