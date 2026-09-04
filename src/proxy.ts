import { NextRequest, NextResponse } from 'next/server';

/**
 * Захисна сітка для платежів, створених до появи /api/pay/return:
 * WayForPay повертає гравця POST-запитом, а App Router вважає будь-який
 * POST на сторінку викликом Server Action і падає з «Server action not
 * found». Перетворюємо такий POST на звичайний GET тієї ж сторінки.
 * Справжні Server Actions мають заголовок next-action — їх не чіпаємо.
 */
export function proxy(req: NextRequest) {
  if (req.method === 'POST' && !req.headers.get('next-action')) {
    return NextResponse.redirect(req.nextUrl, 303);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/kabinet/:path*'] };
