/**
 * Ассет героя-оповідача (генерований через AutoSprite).
 * poses: ключ пози/емоції → PNG з прозорим фоном (по панелі на позу).
 * Поки поз нема — Actor відкатується на sheet (анімація) або still.
 * Після кастингу героя цей конфіг перезаповнюється під обраного.
 */
export const DIRECTOR = {
  /** Пози/емоції під панелі — ДЖЕРЕМІ (GPT-кіт Сергія, нарізаний v2-slice).
   *  Анімаційні листи (talk/walk) — GPT-догенерації, поки статика.
   *  Бабуся-Легенда лишається в /v2/hero/ як запас/камео. */
  poses: {
    hello: '/v2/hero-jeremy/hello.png',
    point: '/v2/hero-jeremy/point.png',
    stroll: '/v2/hero-jeremy/stroll.png',
    strict: '/v2/hero-jeremy/strict.png',
    shrug: '/v2/hero-jeremy/shrug.png',
    hype: '/v2/hero-jeremy/hype.png',
    wink: '/v2/hero-jeremy/wink.png',
    proud: '/v2/hero-jeremy/proud.png',
    celebrate: '/v2/hero-jeremy/celebrate.png',
  } as Record<string, string>,
  still: '/v2/hero-jeremy/still.png',
  sheet: null as null | {
    src: string;
    frameWidth: number;
    frameHeight: number;
    frames: number;
    columns: number;
    fps: number;
  },
};
