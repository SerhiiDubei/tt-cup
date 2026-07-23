import type { Sheet } from './Sprite';

/**
 * Масовка «мʼячики-люди» (реф: walk cycles Олександра Гладуна, R-009).
 * Персонаж AutoSprite cmrov6thk… — помаранчевий мʼяч з ніжками і кепкою.
 * 4 характерні ходи — справжні кадрові спрайт-листи (не CSS-кістки).
 * Кольорові варіанти — hue-rotate поверх готових кадрів (чорний контур
 * і білі деталі не зачіпає).
 */

export type WalkStyle = 'normal' | 'sneak' | 'hop' | 'rush';

const sheet = (src: string): Sheet => ({
  src,
  frameWidth: 256,
  frameHeight: 256,
  frames: 25,
  columns: 5,
  fps: 12,
});

export const BALLFOLK: Record<WalkStyle, Sheet | null> = {
  normal: sheet('/v2/folk/walk-normal.png'),
  sneak: sheet('/v2/folk/walk-sneak.png'),
  hop: sheet('/v2/folk/walk-hop.png'),
  rush: sheet('/v2/folk/walk-rush.png'),
};

/** Відтінки масовки: 0 = рідний помаранчевий. */
export const FOLK_HUES = [0, 45, 130, 200, 280, 320];
