import type { Sheet } from './Sprite';

/**
 * Ассети Легенди для скрол-історії /v3.
 * walk — скраб-цикл ходьби (заповнюється після генерації wf_3ba11fa8);
 * поки null — сцена «будь-де» веде позу stroll без прокрутки кадрів.
 */
export const HERO3 = {
  /** ДЖЕРЕМІ — головний герой (GPT-кіт Сергія). Анімлисти = GPT-догенерації. */
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
    still: '/v2/hero-jeremy/still.png',
  } as Record<string, string>,
  talk: null as Sheet | null,
  walk: null as Sheet | null,
};
