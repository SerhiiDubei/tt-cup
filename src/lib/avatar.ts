// Character traits → prompt for the Memphis-style AI avatar. Shared by builder + /api/avatar.

export type Traits = {
  gender: string; skin: string; hair: string; hairColor: string; outfit: string; accessory: string;
};

type Opt = { id: string; label: string; en: string; swatch?: string };

export const AVATAR_OPTIONS: Record<keyof Traits, Opt[]> = {
  gender: [
    { id: 'female', label: 'Жінка', en: 'woman' },
    { id: 'male', label: 'Чоловік', en: 'man' },
    { id: 'neutral', label: 'Будь-хто', en: 'androgynous person' },
  ],
  skin: [
    { id: 'light', label: 'Світла', en: 'light skin', swatch: '#FBD3B4' },
    { id: 'medium', label: 'Середня', en: 'medium skin', swatch: '#E0A878' },
    { id: 'tan', label: 'Засмага', en: 'tan skin', swatch: '#C68642' },
    { id: 'dark', label: 'Темна', en: 'dark brown skin', swatch: '#6B4226' },
  ],
  hair: [
    { id: 'short', label: 'Коротке', en: 'short hair' },
    { id: 'long', label: 'Довге', en: 'long flowing hair' },
    { id: 'ponytail', label: 'Хвіст', en: 'high ponytail' },
    { id: 'curly', label: 'Кучері', en: 'big curly afro hair' },
    { id: 'buzz', label: 'Їжачок', en: 'buzz cut' },
    { id: 'bun', label: 'Пучок', en: 'top bun' },
  ],
  hairColor: [
    { id: 'pink', label: 'Рожеве', en: 'bright pink', swatch: '#FF2E88' },
    { id: 'blue', label: 'Синє', en: 'electric blue', swatch: '#2D4BFF' },
    { id: 'black', label: 'Чорне', en: 'black', swatch: '#16110D' },
    { id: 'blonde', label: 'Блонд', en: 'blonde', swatch: '#FFC619' },
    { id: 'brown', label: 'Каштан', en: 'brown', swatch: '#8B5A2B' },
    { id: 'mint', label: 'Мʼята', en: 'mint green', swatch: '#A6E22E' },
  ],
  outfit: [
    { id: 'jersey-red', label: 'Червона форма', en: 'red sports jersey', swatch: '#FF5A36' },
    { id: 'jersey-cyan', label: 'Бірюзова форма', en: 'cyan sports jersey', swatch: '#00CFC1' },
    { id: 'jersey-purple', label: 'Фіолетова форма', en: 'purple sports jersey', swatch: '#8A45FF' },
    { id: 'hoodie', label: 'Худі', en: 'casual hoodie', swatch: '#2D4BFF' },
    { id: 'polo', label: 'Поло', en: 'white polo shirt', swatch: '#FFFFFF' },
  ],
  accessory: [
    { id: 'none', label: 'Без', en: 'no accessories' },
    { id: 'headband', label: 'Пов’язка', en: 'a sporty headband' },
    { id: 'glasses', label: 'Окуляри', en: 'cool glasses' },
    { id: 'cap', label: 'Кепка', en: 'a baseball cap' },
    { id: 'wristband', label: 'Напульсник', en: 'wristbands' },
  ],
};

export const DEFAULT_TRAITS: Traits = {
  gender: 'female', skin: 'light', hair: 'short', hairColor: 'pink', outfit: 'jersey-red', accessory: 'headband',
};

function en(group: keyof Traits, id: string): string {
  return (AVATAR_OPTIONS[group].find((o) => o.id === id) || AVATAR_OPTIONS[group][0]).en;
}

// Superpower per play-style — a LIGHT accent that must not cover the face.
export const SUPERPOWERS: Record<string, string> = {
  attacker: 'a subtle electric lightning / energy spark effect near the table-tennis paddle',
  defender: 'a subtle glowing protective shield aura softly around them',
  spinner: 'a subtle swirling spiral / motion vortex around the ball',
  allrounder: 'subtle sparkling stars and a soft magical glow around them',
};
export const SUPERPOWER_LABEL: Record<string, string> = {
  attacker: '⚡ блискавка', defender: '🛡 щит-аура', spinner: '🌀 вихор', allrounder: '✨ зорі',
};

// The paddle is a stylised signature attribute that varies per play-style (not the same one for everyone).
export const PADDLES: Record<string, string> = {
  attacker: 'an aggressive blade-edged table-tennis paddle wreathed in forward motion streaks',
  defender: 'a heavy reinforced shield-like table-tennis paddle with a steady protective aura',
  spinner: 'a sleek table-tennis paddle trailing curved spiral spin-energy',
  allrounder: 'a balanced ornate table-tennis paddle with a twin-toned grip',
};

/**
 * Prompt for image-to-image. Gemini-2.5-flash-image has NO fidelity weights, so likeness is
 * controlled by wording: lock identity, frame it as EDITING the photo, keep the REAL clothing
 * (no costume), and only restyle the art. The paddle is a per-play-style stylised attribute.
 */
export function buildSelfiePrompt(style: string): string {
  const power = SUPERPOWERS[style] || SUPERPOWERS.allrounder;
  const paddle = PADDLES[style] || PADDLES.allrounder;
  return [
    "Re-draw this exact person as a One Piece anime illustration in Eiichiro Oda's art style: bold clean black ink linework, cel-shading, saturated colours, dramatic shounen lighting and rim light — clearly a hand-drawn ANIME illustration (not a photo, not a flat cartoon).",
    'CRUCIAL — keep the SAME recognizable person: same face shape, features, proportions, skin tone, hairline, eyebrows and expression as the source photo. Do NOT beautify, slim or smooth the face; someone who knows them must instantly recognise them.',
    "Keep the person's REAL clothing from the photo (same garments and colours). Do NOT add a pirate outfit, cape, coat, hat, armor or any themed costume.",
    `Give them ${paddle} as a signature attribute; accent the paddle and lighting with ${power}, without covering or distorting the face.`,
    'Head and shoulders, centered, square, crisp and high detail. Simple uncluttered background. No text, no watermark, no logos.',
  ].join(' ');
}

export function buildAvatarPrompt(t: Traits): string {
  const g = en('gender', t.gender);
  return [
    `Bold Memphis-style flat vector avatar illustration, head and shoulders, of a confident ${g} table-tennis player.`,
    `${en('hair', t.hair)}, ${en('hairColor', t.hairColor)} colour; ${en('skin', t.skin)}; wearing a ${en('outfit', t.outfit)}; ${en('accessory', t.accessory)}.`,
    `Holding a table-tennis paddle near the face. Thick bold black outlines, flat vibrant colours, playful geometric confetti shapes around, solid cream (#FBF1DD) background.`,
    `Centered square avatar, friendly expression, sticker style. No text, no watermark.`,
  ].join(' ');
}
