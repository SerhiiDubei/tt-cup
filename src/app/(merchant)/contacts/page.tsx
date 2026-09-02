import { MERCHANT, PRODUCT, SHOP_NAME, filled } from '@/lib/merchant';

export const metadata = { title: 'Контакти і реквізити · DRUID BATTLE CUP' };

const V = ({ v }: { v: string }) =>
  filled(v) ? <>{v}</> : <span className="mc-todo">не заповнено</span>;

/** Вимога WayForPay №1: повне найменування, ІПН, юридична та фактична адреси, телефон, email. */
export default function Contacts() {
  const incomplete = !filled(MERCHANT.legalName) || !filled(MERCHANT.taxId);
  return (
    <>
      <h1 className="mc-h1">КОНТАКТИ І РЕКВІЗИТИ</h1>
      <p className="mc-upd">Організатор турніру {SHOP_NAME}</p>
      {incomplete && (
        <div className="mc-warn">
          Реквізити ще не заповнені. Перед поданням заявки у платіжну систему
          внеси їх у <b>src/lib/merchant.ts</b> — вони підставляться на всі сторінки одразу.
        </div>
      )}
      <div className="mc-body">
        <h2>ПРОДАВЕЦЬ</h2>
        <dl className="mc-dl">
          <dt>Повне найменування</dt><dd><V v={MERCHANT.legalName} /></dd>
          <dt>ІПН / РНОКПП</dt><dd><V v={MERCHANT.taxId} /></dd>
          <dt>Юридична адреса</dt><dd><V v={MERCHANT.legalAddress} /></dd>
          <dt>Фактична адреса</dt><dd><V v={MERCHANT.actualAddress} /></dd>
          {filled(MERCHANT.edr) && (<><dt>Запис у ЄДР</dt><dd>{MERCHANT.edr}</dd></>)}
        </dl>

        <h2>ЗВʼЯЗОК</h2>
        <dl className="mc-dl">
          <dt>Телефон</dt><dd><V v={MERCHANT.phone} /></dd>
          <dt>Email</dt><dd><V v={MERCHANT.email} /></dd>
          <dt>Телеграм</dt><dd><a href="https://t.me/bomberman047">@bomberman047</a></dd>
        </dl>
        <p>Відповідаємо щодня з 10:00 до 20:00 за київським часом.</p>

        <h2>МІСЦЕ НАДАННЯ ПОСЛУГИ</h2>
        <p>{PRODUCT.venue}. Дата проведення — {PRODUCT.eventDate}.</p>
      </div>
    </>
  );
}
