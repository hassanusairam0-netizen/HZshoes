// HASSAN ZHANG — HZ monogram.
// A Didone H (thick stems, hairline crossbar) interlaced with a Z whose
// hairline bars pierce the stems: the top bar passes over the left stem,
// the bottom bar passes under the right stem. Drawn on a 120 × 120 grid.

// h = hairline weight. 1.7 for display sizes, heavier for favicons and tiny embossing.
function monoPaths(h = 1.7) {
  const r = (x, y, w, hh) => `M${x} ${y}h${w}v${hh}h${-w}z`;
  const s = 8; // stem weight
  const zTop = 38, zBot = 82; // Z bar outer edges
  return [
    // H stems; the left one is split where the Z top bar passes over it
    r(34, 30, s, zTop - 0.8 - 30), r(34, zTop + h + 0.8, s, 90 - (zTop + h + 0.8)),
    r(78, 30, s, 60),
    // serifs
    r(29, 30, 18, h), r(29, 90 - h, 18, h), r(73, 30, 18, h), r(73, 90 - h, 18, h),
    // crossbar, broken where the Z diagonal crosses it
    r(42, 60 - h / 2, 13, h), r(65, 60 - h / 2, 13, h),
    // Z top bar + drop serif
    r(26, zTop, 48, h), r(26, zTop, h, 5.2),
    // Z diagonal
    `M66.5 ${zTop + h}H74L53.5 ${zBot - h}H46z`,
    // Z bottom bar, split under the right stem, + rising serif
    r(46, zBot - h, 31.2, h), r(86.8, zBot - h, 7.2, h), r(94 - h, zBot - 6.8, h, 6.8),
  ];
}
const MONO = monoPaths();

export const MONOGRAM_PATHS = MONO;

/**
 * Returns the monogram as an SVG string.
 * opts.fill  — fill colour or 'gold' for the foil gradient
 * opts.ring  — draw the heritage seal rings
 * opts.bg    — optional background fill
 */
export function logoSVG({ fill = 'gold', ring = true, bg = null, size = null, id = 'hz', weight = 1.7 } = {}) {
  const paths = weight === 1.7 ? MONO : monoPaths(weight);
  const grad = fill === 'gold';
  const paint = grad ? `url(#${id}-g)` : fill;
  const dims = size ? `width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" ${dims} role="img" aria-label="Hassan Zhang monogram">
${grad ? `<defs><linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#F3DE9A"/><stop offset=".38" stop-color="#C9A24A"/>
<stop offset=".62" stop-color="#E9CF83"/><stop offset="1" stop-color="#9C7A2E"/></linearGradient></defs>` : ''}
${bg ? `<rect width="120" height="120" fill="${bg}"/>` : ''}
${ring ? `<circle cx="60" cy="60" r="56.5" fill="none" stroke="${paint}" stroke-width="${Math.max(1.6, weight)}"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="${paint}" stroke-width=".6"/>` : ''}
<g fill="${paint}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>
</svg>`;
}

export function logoDataURL(opts) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(logoSVG(opts));
}

/** Loads the monogram as an <img> for drawing into canvases. */
export function logoImage(opts) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = logoDataURL(opts);
  });
}
