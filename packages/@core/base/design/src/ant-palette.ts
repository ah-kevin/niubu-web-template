/**
 * Hex-only port of @ant-design/colors@8.0.1 generate and
 * @ant-design/fast-color@3.0.1 RGB/HSV conversion/mix. MIT; see ant-colors.LICENSE.
 * https://unpkg.com/@ant-design/colors@8.0.1/es/generate.js
 * https://unpkg.com/@ant-design/fast-color@3.0.1/es/FastColor.js
 */
type RGB = readonly [number, number, number];
type HSV = { h: number; s: number; v: number };

export function hexRGB(color: string): RGB {
  const hex = color.length <= 5 ? [...color.slice(1)].map(value => value + value).join('') : color.slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
const colorAlpha = (color: string) =>
  color.length === 5
    ? parseInt(color[4]! + color[4]!, 16) / 255
    : color.length === 9
      ? parseInt(color.slice(7), 16) / 255
      : 1;
const toHex = (rgb: RGB, alpha = 1) =>
  '#' +
  rgb.map(value => value.toString(16).padStart(2, '0')).join('') +
  (alpha < 1
    ? Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')
    : '');
function toHSV([r, g, b]: RGB): HSV {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const h =
    delta === 0
      ? 0
      : Math.round(
          60 * (r === max ? (g - b) / delta + (g < b ? 6 : 0) : g === max ? (b - r) / delta + 2 : (r - g) / delta + 4),
        );
  return { h, s: delta === 0 ? 0 : delta / max, v: max / 255 };
}
function fromHSV({ h, s, v }: HSV): RGB {
  const hue = ((h % 360) + 360) % 360,
    sector = Math.floor(hue / 60),
    fraction = hue / 60 - sector;
  const value = Math.round(v * 255);
  if (s <= 0) return [value, value, value];
  const p = Math.round(v * (1 - s) * 255),
    q = Math.round(v * (1 - s * fraction) * 255),
    t = Math.round(v * (1 - s * (1 - fraction)) * 255);
  const sectors: RGB[] = [
    [value, t, p],
    [q, value, p],
    [p, value, t],
    [p, q, value],
    [t, p, value],
    [value, p, q],
  ];
  return sectors[sector]!;
}
function hue(hsv: HSV, step: number, light = false) {
  const direction = Math.round(hsv.h) >= 60 && Math.round(hsv.h) <= 240 ? 1 : -1;
  return (Math.round(hsv.h) + direction * (light ? -2 : 2) * step + 360) % 360;
}
function saturation(hsv: HSV, step: number, light = false) {
  if (hsv.h === 0 && hsv.s === 0) return hsv.s;
  let value = light ? hsv.s - 0.16 * step : hsv.s + (step === 4 ? 0.16 : 0.05 * step);
  value = Math.min(1, value);
  if (light && step === 5 && value > 0.1) value = 0.1;
  return Math.round(Math.max(0.06, value) * 100) / 100;
}
function brightness(hsv: HSV, step: number, light = false) {
  return Math.round(Math.max(0, Math.min(1, hsv.v + (light ? 0.05 : -0.15) * step)) * 100) / 100;
}
const darkMap = [
  [7, 15],
  [6, 25],
  [5, 30],
  [5, 45],
  [5, 65],
  [5, 85],
  [4, 90],
  [3, 95],
  [2, 97],
  [1, 98],
] as const;

export function antPalette(color: string, dark = false): readonly string[] {
  const base = hexRGB(color),
    hsv = toHSV(base),
    colors: RGB[] = [];
  for (let step = 5; step > 0; step--)
    colors.push(fromHSV({ h: hue(hsv, step, true), s: saturation(hsv, step, true), v: brightness(hsv, step, true) }));
  colors.push(base);
  for (let step = 1; step <= 4; step++)
    colors.push(fromHSV({ h: hue(hsv, step), s: saturation(hsv, step), v: brightness(hsv, step) }));
  if (!dark) return colors.map((rgb, index) => toHex(rgb, index === 5 ? colorAlpha(color) : 1));
  return darkMap.map(([index, amount]) => {
    const rgb = colors[index]!,
      channel = (value: number) => Math.round(((value - 20) * amount) / 100 + 20);
    const alpha = Math.round((1 + (((index === 5 ? colorAlpha(color) : 1) - 1) * amount) / 100) * 100) / 100;
    return toHex([channel(rgb[0]), channel(rgb[1]), channel(rgb[2])], alpha);
  });
}

export const alphaColor = (color: string, alpha: number) => `rgba(${hexRGB(color).join(',')},${alpha})`;

/** Antdv Next 1.5.2 theme/util/getAlphaColor, MIT; see ant-colors.LICENSE. */
export function antOutlineColor(front: string, background: string): string {
  if (colorAlpha(front) < 1) return front;
  const foreground = hexRGB(front),
    backdrop = hexRGB(background);
  for (let opacity = 0.01; opacity <= 1; opacity += 0.01) {
    const channels = foreground.map((value, index) => Math.round((value - backdrop[index]! * (1 - opacity)) / opacity));
    if (channels.every(value => value >= 0 && value <= 255))
      return `rgba(${channels.join(',')},${Math.round(opacity * 100) / 100})`;
  }
  return `rgb(${foreground.join(',')})`;
}
