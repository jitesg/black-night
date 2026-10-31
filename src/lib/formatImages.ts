/**
 * formatImages.ts — pictures in formats: a line "[[चित्र]] <name>" prints the
 * named picture centred (print, Word, editor). Pure.
 */
import { FORMAT_IMAGE_DATA } from './formatImagesData';

/** Largest printed height of a picture on the A4 sheet (mm); width is at most the text width. */
export const IMAGE_HEIGHT_MM = 175;

export function formatImage(name: string): { uri: string; png: string; w: number; h: number } | null {
  const d = FORMAT_IMAGE_DATA[name.trim()];
  return d ? { uri: `data:image/png;base64,${d.png}`, png: d.png, w: d.w, h: d.h } : null;
}

/** Base64 → bytes without Node's Buffer (works on the phone). */
export function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = new Uint8Array(128);
  for (let i = 0; i < chars.length; i++) map[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = map[clean.charCodeAt(i)], b = map[clean.charCodeAt(i + 1)];
    const c = map[clean.charCodeAt(i + 2)] ?? 0, d = map[clean.charCodeAt(i + 3)] ?? 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length && o < out.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length && o < out.length) out[o++] = n & 255;
  }
  return out;
}
