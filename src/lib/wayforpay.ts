import crypto from 'node:crypto';

/**
 * WayForPay. Підпис — HMAC-MD5 від полів, зчеплених крапкою з комою,
 * у строго заданому порядку. Порядок різний для запиту й для відповіді,
 * і будь-яка розбіжність дає reasonCode 1113 «Invalid signature».
 */
export const WFP = {
  account: process.env.WFP_MERCHANT_ACCOUNT ?? '',
  secret: process.env.WFP_SECRET_KEY ?? '',
  domain: 'teniss.vercel.app',
  payUrl: 'https://secure.wayforpay.com/pay',
  apiUrl: 'https://api.wayforpay.com/api',
};

export const wfpReady = () => WFP.account.length > 0 && WFP.secret.length > 0;

const sign = (parts: (string | number)[]) =>
  crypto.createHmac('md5', WFP.secret).update(parts.join(';'), 'utf8').digest('hex');

export type PurchaseInput = {
  orderReference: string;
  amount: number;
  productName: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  clientEmail?: string;
  returnUrl: string;
  serviceUrl: string;
};

/** Поля форми, яку браузер сабмітить на secure.wayforpay.com/pay. */
export function purchaseForm(i: PurchaseInput) {
  const orderDate = Math.floor(Date.now() / 1000);
  const amount = i.amount.toFixed(2);
  const merchantSignature = sign([
    WFP.account, WFP.domain, i.orderReference, orderDate,
    amount, 'UAH', i.productName, 1, amount,
  ]);
  return {
    merchantAccount: WFP.account,
    merchantDomainName: WFP.domain,
    merchantTransactionSecureType: 'AUTO',
    orderReference: i.orderReference,
    orderDate: String(orderDate),
    amount,
    currency: 'UAH',
    productName: [i.productName],
    productCount: ['1'],
    productPrice: [amount],
    clientFirstName: i.clientFirstName ?? '',
    clientLastName: i.clientLastName ?? '',
    clientPhone: (i.clientPhone ?? '').replace(/\D/g, ''),
    clientEmail: i.clientEmail ?? '',
    language: 'UA',
    returnUrl: i.returnUrl,
    serviceUrl: i.serviceUrl,
    merchantSignature,
  };
}

export type Callback = {
  merchantAccount?: string; orderReference?: string; amount?: number | string;
  currency?: string; authCode?: string; cardPan?: string;
  transactionStatus?: string; reasonCode?: string | number; merchantSignature?: string;
};

/** Перевірка підпису вхідного колбека — без неї будь-хто міг би
    оголосити заявку оплаченою простим POST. */
export function verifyCallback(c: Callback) {
  const expected = sign([
    c.merchantAccount ?? '', c.orderReference ?? '', c.amount ?? '',
    c.currency ?? '', c.authCode ?? '', c.cardPan ?? '',
    c.transactionStatus ?? '', c.reasonCode ?? '',
  ]);
  return expected === c.merchantSignature;
}

/** Відповідь, якої WayForPay чекає у відповідь на колбек. */
export function callbackAck(orderReference: string) {
  const time = Math.floor(Date.now() / 1000);
  return {
    orderReference,
    status: 'accept',
    time,
    signature: sign([orderReference, 'accept', time]),
  };
}
