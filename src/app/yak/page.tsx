import Link from 'next/link';
import { MERCHANT, PRODUCT } from '@/lib/merchant';

const TG = 'https://t.me/bomberman047';

/**
 * «Як усе влаштовано» — заміна старим /pravyla, які досі описували
 * серпневий цикл («жеребкування 2.08», «День Х 23 серпня»).
 * Одна сторінка, яку можна прочитати за хвилину і закрити.
 */
export default function YakPage() {
  return (
    <div className="kb-root"><div className="kb-phone yk">
      <div className="kb-hd">
        <div className="kb-ava" aria-hidden>DBC</div>
        <div className="kb-who">
          <b>ЯК УСЕ ВЛАШТОВАНО</b>
          <span>DRUID BATTLE CUP · 13 вересня</span>
        </div>
      </div>

      <h1 className="yk-h1">ТУРНІР ЗА ЧОТИРИ КРОКИ</h1>
      <p className="yk-lead">Без води. Якщо після цієї сторінки лишиться питання — пиши, відповім особисто.</p>

      <section className="yk-sec">
        <div className="kb-lbl">ЯК ЦЕ ЙДЕ</div>
        <ol className="yk-steps">
          <li className="yk-step"><i>1</i><div>
            <b>Реєструєшся — до 7 вересня, 23:59</b>
            <span>Місць 32. Хто перший — той грає, а перші 10 ще й платять на 20% менше.</span>
          </div></li>
          <li className="yk-step"><i>2</i><div>
            <b>7 вересня система розкидає пари</b>
            <span>Жереб зводить суперників за силою — щоб було чесно, а не щоб когось знести в першому колі.</span>
          </div></li>
          <li className="yk-step"><i>3</i><div>
            <b>8–12 вересня граєш вісім матчів</b>
            <span>Це не гра в телефоні. Домовляєтесь самі: час і місце обираєте ви двоє, рахунок вносите в систему.</span>
          </div></li>
          <li className="yk-step"><i>4</i><div>
            <b>13 вересня — День Х на Друїді</b>
            <span>Очки ділять усіх на дві ліги, у кожної своя сітка і свій приз. Вилетіти в нікуди неможливо.</span>
          </div></li>
        </ol>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ПРО МАТЧІ</div>
        <p>Вісім матчів із різними людьми. Граємо <em>до двох перемог у сетах</em>, сет — до 11 очок.</p>
        <p>Рахунок вносить будь-хто з пари, другий підтверджує. Не зіграли до 12-го — матч рахується нульовим обом.</p>
        <p>Після матчу оцінюєш, чи грав суперник на свій заявлений рівень. Хитрувати з рівнем невигідно: це видно за перші два матчі.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ДВІ ЛІГИ</div>
        <p><em>Верхня</em> — топ за очками онлайн-частини. <em>Нижня</em> — усі інші, зі своєю сіткою і своїм призом.</p>
        <p>Сенс простий: середнячок грає з середнячками і має реальний шанс на фінал, а не вилітає від розрядника на першій хвилині.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ФАН-ЧАСТИНА</div>
        <p>13 вересня о <em>13:00</em> — міні-ігри для всіх охочих, навіть якщо ти не в сітці. Стаканчики, відро і ще пара сюрпризів.</p>
        <p>Фанові очки рахуються нарівні зі спортивними — є окрема номінація.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">СКІЛЬКИ</div>
        <div className="yk-price">
          <div>
            <b>ГРАВЕЦЬ · 420 ₴</b>
            <span>Все, щоб грати: стіл, сітка, мʼячі, суддівство і призовий фонд.</span>
          </div>
          <div>
            <b>МЕЦЕНАТ · 840 ₴</b>
            <span>Те саме — плюс свідома підтримка організаторів і самої затії,
              і подарунок у день турніру.</span>
          </div>
        </div>
        <p style={{ marginTop: 12 }}><em>Перші 10 реєстрацій — мінус 20%</em> на будь-який пакет.
          Знижка застосовується сама, нічого вводити не треба.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ЩО ВХОДИТЬ У ВНЕСОК</div>
        <p>Стіл, сітка, мʼячі, суддівство, організація сітки й розкладу, фан-частина
          і <em>призовий фонд</em>.</p>
        <p><em>Їжа й напої не входять</em> — вони будуть на місці, але за свої.
          Дорога до Друїда теж на тобі.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ЯК ОПЛАТИТИ</div>
        <p>Онлайн банківською карткою <em>Visa</em> або <em>Mastercard</em> через платіжний
          сервіс <a href="https://wayforpay.com" rel="noreferrer">WayForPay</a>.
          Валюта розрахунків — гривня. Інших способів оплати не передбачено.</p>
        <p>Одразу після успішного платежу приходить персональне посилання на кабінет —
          це і є підтвердження участі. Ніякого паперу отримувати не треба.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ЯК І КОЛИ НАДАЄТЬСЯ ПОСЛУГА</div>
        <p>Онлайн-частина — на цьому ж сайті: жеребкування {'\u2014'} 7 вересня, матчі й таблиця
          з 8 по 12 вересня в кабінеті учасника.</p>
        <p>Офлайн-частина — <em>{PRODUCT.venue}</em>, {PRODUCT.eventDate}.
          Географія надання послуги — Україна, місто Івано-Франківськ.</p>
        <p>Це послуга, а не товар: <em>доставка не передбачена</em>, служби доставки не залучаються.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ПОВЕРНЕННЯ КОШТІВ</div>
        <p>Повертаємо <em>повністю</em> — при відмові не пізніше ніж за 3 доби до турніру,
          при скасуванні події організатором, при помилковій або подвійній оплаті.</p>
        <p><em>50%</em> — при відмові менше ніж за 3 доби. <em>Без повернення</em> — при неявці
          без попередження. Повний порядок і строки — на сторінці{' '}
          <Link href="/refund">«Повернення коштів»</Link>.</p>
      </section>

      <section className="yk-sec">
        <div className="kb-lbl">ПРОДАВЕЦЬ</div>
        <dl className="mc-dl">
          <dt>Найменування</dt><dd>{MERCHANT.legalName}</dd>
          <dt>ІПН / РНОКПП</dt><dd>{MERCHANT.taxId}</dd>
          <dt>Юридична адреса</dt><dd>{MERCHANT.legalAddress}</dd>
          <dt>Фактична адреса</dt><dd>{MERCHANT.actualAddress}</dd>
          <dt>Телефон</dt><dd>{MERCHANT.phone}</dd>
          <dt>Email</dt><dd>{MERCHANT.email}</dd>
        </dl>
        <p>Умови співпраці повністю — у{' '}
          <Link href="/oferta">публічному договорі</Link>.</p>
      </section>

      <div className="yk-cta kb-act">
        <Link className="kb-btn" href="/kabinet">МІЙ КАБІНЕТ</Link>
        <a className="kb-btn ghost" href={TG}>Лишилось питання — напиши</a>
      </div>

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
