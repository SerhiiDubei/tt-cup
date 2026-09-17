// Повернення платежу WayForPay (transactionType REFUND).
//
// Гроші рухає ТІЛЬКИ людина: без --apply скрипт лише показує запит і підпис.
// Секрети локально не лежать (Vercel їх не віддає) — взяти з
// Vercel → teniss → Settings → Environment Variables.
//
//   WFP_MERCHANT_ACCOUNT=... WFP_SECRET_KEY=... \
//   node scripts/wfp-refund.mjs DBC-16-1788979619890 420 "Зняття з турніру за проханням учасника" --apply
//
// Підпис (wiki.wayforpay.com/en/view/852115): HMAC_MD5 від
// merchantAccount;orderReference;amount;currency. Після успіху WayForPay шле
// колбек на serviceUrl зі статусом Refunded → /api/pay/callback знімає paid.
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const [ref, amountArg, ...restArgs] = args.filter((a) => a !== '--apply');
const comment = restArgs.join(' ') || 'Повернення внеску за проханням учасника';

if (!ref || !amountArg) {
  console.error('usage: node scripts/wfp-refund.mjs <orderReference> <amount> [comment] [--apply]');
  process.exit(1);
}
const account = process.env.WFP_MERCHANT_ACCOUNT ?? '';
const secret = process.env.WFP_SECRET_KEY ?? '';
if (!account || !secret) {
  console.error('Потрібні WFP_MERCHANT_ACCOUNT і WFP_SECRET_KEY (Vercel → teniss → Environment Variables).');
  process.exit(1);
}

const amount = Number(amountArg);
if (!Number.isFinite(amount) || amount <= 0) { console.error('amount має бути числом > 0'); process.exit(1); }
// Той самий рядок і в підписі, і в тілі — інакше 1113 Invalid signature.
const amountStr = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
const currency = 'UAH';
const merchantSignature = crypto
  .createHmac('md5', secret)
  .update([account, ref, amountStr, currency].join(';'), 'utf8')
  .digest('hex');

const body = {
  transactionType: 'REFUND',
  merchantAccount: account,
  orderReference: ref,
  amount: amountStr,
  currency,
  comment,
  merchantSignature,
  apiVersion: 1,
};

console.log('Запит REFUND →', JSON.stringify({ ...body, merchantSignature: merchantSignature.slice(0, 6) + '…' }, null, 2));
if (!apply) {
  console.log('\nСухий прогін: нічого не відправлено. Додай --apply, щоб справді повернути гроші.');
  process.exit(0);
}

const r = await fetch('https://api.wayforpay.com/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const text = await r.text();
let j;
try { j = JSON.parse(text); } catch { console.error('HTTP', r.status, text.slice(0, 300)); process.exit(2); }
console.log('Відповідь ←', JSON.stringify(j, null, 2));
const ok = j.transactionStatus === 'Refunded' || j.transactionStatus === 'RefundInProcessing' || j.transactionStatus === 'Voided';
if (!ok) console.error('Повернення НЕ пройшло: reasonCode', j.reasonCode, j.reason);
process.exit(ok ? 0 : 2);
