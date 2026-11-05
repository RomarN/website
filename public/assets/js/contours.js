/**
 * Geanimeerde hoogtelijnen (topografische kaart) via marching squares.
 * Hoogteveld = som van sinussen met domain warp + een "heuvel" onder de cursor.
 */

const niveaus = [-1.4, -1.15, -0.9, -0.65, -0.4, -0.15, 0.1, 0.35, 0.6, 0.85, 1.1, 1.35, 1.6];
const accent_niveau = 0.6;

// Marching squares: per hoekcombinatie (0-15) de randparen die verbonden worden
const segment_tabel = [
  [], [3, 2], [2, 1], [3, 1], [0, 1], [3, 0, 2, 1], [0, 2], [3, 0],
  [3, 0], [0, 2], [3, 2, 0, 1], [0, 1], [3, 1], [2, 1], [3, 2], []
];
const rand_x = new Float32Array(4);
const rand_y = new Float32Array(4);

/**
 * Hoogte van het veld op een punt
 * @param {number} x
 * @param {number} y
 * @param {number} t - Tijd in seconden
 * @param {{x: number, y: number, kracht: number}} cursor
 * @returns {number}
 */
function get_hoogte (x, y, t, cursor) {
  const wx = x + Math.sin(y * 0.004 + t * 0.15) * 60;
  const wy = y + Math.cos(x * 0.003 - t * 0.12) * 60;
  let h = Math.sin(wx * 0.0065 + t * 0.18) * Math.cos(wy * 0.0075 - t * 0.14);
  h += 0.55 * Math.sin((wx + wy) * 0.0045 + t * 0.09);
  h += 0.25 * Math.cos(wx * 0.013 - wy * 0.009 + t * 0.21);

  if (cursor.kracht > 0) {
    const dx = x - cursor.x;
    const dy = y - cursor.y;
    h += 1.3 * cursor.kracht * Math.exp(-(dx * dx + dy * dy) / (2 * 120 * 120));
  }
  return h;
}

/**
 * Lineaire interpolatie van de drempel tussen twee hoekwaarden
 * @param {number} a
 * @param {number} b
 * @param {number} drempel
 * @returns {number} Fractie 0..1
 */
function interpoleer (a, b, drempel) {
  const verschil = b - a;
  return verschil == 0 ? 0.5 : (drempel - a) / verschil;
}

/**
 * Tekent voor één niveau alle lijnsegmenten in het huidige path (marching squares)
 * @param {CanvasRenderingContext2D} ctx
 * @param {Float32Array} veld
 * @param {number} kolommen
 * @param {number} rijen
 * @param {number} drempel
 * @param {number} c - Celgrootte in CSS-pixels
 * @returns {void}
 */
function teken_niveau (ctx, veld, kolommen, rijen, drempel, c) {
  for (let j = 0; j < rijen - 1; j++) {
    for (let i = 0; i < kolommen - 1; i++) {
      const tl = veld[j * kolommen + i];
      const tr = veld[j * kolommen + i + 1];
      const br = veld[(j + 1) * kolommen + i + 1];
      const bl = veld[(j + 1) * kolommen + i];
      const geval = (tl > drempel ? 8 : 0) | (tr > drempel ? 4 : 0) | (br > drempel ? 2 : 0) | (bl > drempel ? 1 : 0);
      if (geval == 0 || geval == 15) continue;

      const x = i * c;
      const y = j * c;
      // Punt op rand: 0 boven, 1 rechts, 2 onder, 3 links
      rand_x[0] = x + c * interpoleer(tl, tr, drempel); rand_y[0] = y;
      rand_x[1] = x + c; rand_y[1] = y + c * interpoleer(tr, br, drempel);
      rand_x[2] = x + c * interpoleer(bl, br, drempel); rand_y[2] = y + c;
      rand_x[3] = x; rand_y[3] = y + c * interpoleer(tl, bl, drempel);

      const segmenten = segment_tabel[geval];
      for (let s = 0; s < segmenten.length; s += 2) {
        ctx.moveTo(rand_x[segmenten[s]], rand_y[segmenten[s]]);
        ctx.lineTo(rand_x[segmenten[s + 1]], rand_y[segmenten[s + 1]]);
      }
    }
  }
}

/**
 * Leest de kleuren uit CSS custom properties (wisselt mee met het thema)
 * @returns {{lijn: string, accent: string}}
 */
function get_kleuren () {
  const stijl = getComputedStyle(document.documentElement);
  return {
    lijn: `rgb(${stijl.getPropertyValue('--contour').trim()} / 0.09)`,
    accent: stijl.getPropertyValue('--accent').trim()
  };
}

/**
 * Start de contour-animatie op een canvas
 * @param {HTMLCanvasElement} canvas
 * @param {{reduced_motion: boolean, is_licht: boolean}} opties
 *   reduced_motion: één statisch frame. is_licht: touch-apparaat, dus grovere grid, lagere resolutie,
 *   30 fps en pauze tijdens scrollen zodat scrollen vloeiend blijft.
 * @returns {void}
 */
export function init_contours (canvas, opties) {
  if (canvas == null) return;
  const { reduced_motion, is_licht } = opties;
  const cel_grootte = is_licht == true ? 22 : 16;
  const max_dpr = is_licht == true ? 1.5 : 2;
  const frame_interval_ms = is_licht == true ? 1000 / 30 : 0;
  let laatste_frame_ms = 0;
  let laatste_scroll_ms = 0;
  let canvas_breedte = 0;
  let canvas_hoogte = 0;
  const ctx = canvas.getContext('2d');
  const cursor = { x: 0, y: 0, kracht: 0, doel: 0 };
  let kolommen = 0;
  let rijen = 0;
  let veld = new Float32Array(0);
  let kleuren = get_kleuren();
  let zichtbaar = true;
  let raf_id = 0;

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, max_dpr);
    const { width, height } = canvas.getBoundingClientRect();
    if (width == canvas_breedte && height == canvas_hoogte) return;
    canvas_breedte = width;
    canvas_hoogte = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kolommen = Math.ceil(width / cel_grootte) + 1;
    rijen = Math.ceil(height / cel_grootte) + 1;
    veld = new Float32Array(kolommen * rijen);
  };

  const teken = (tijd_ms) => {
    const t = tijd_ms / 1000;
    cursor.kracht += (cursor.doel - cursor.kracht) * 0.06;

    for (let j = 0; j < rijen; j++) {
      for (let i = 0; i < kolommen; i++) {
        veld[j * kolommen + i] = get_hoogte(i * cel_grootte, j * cel_grootte, t, cursor);
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    for (const niveau of niveaus) {
      ctx.beginPath();
      teken_niveau(ctx, veld, kolommen, rijen, niveau, cel_grootte);
      const is_accent = niveau == accent_niveau;
      ctx.strokeStyle = is_accent ? kleuren.accent : kleuren.lijn;
      ctx.globalAlpha = is_accent ? 0.35 : 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const loop = (tijd_ms) => {
    const is_scrollend = is_licht == true && tijd_ms - laatste_scroll_ms < 200;
    if (is_scrollend == false && tijd_ms - laatste_frame_ms >= frame_interval_ms) {
      laatste_frame_ms = tijd_ms;
      teken(tijd_ms);
    }
    if (zichtbaar == true && document.hidden == false) raf_id = requestAnimationFrame(loop);
  };

  const start = () => {
    cancelAnimationFrame(raf_id);
    if (reduced_motion == true) {
      teken(0);
      return;
    }
    raf_id = requestAnimationFrame(loop);
  };

  resize();
  new ResizeObserver(() => { resize(); if (reduced_motion == true) teken(0); }).observe(canvas);

  new MutationObserver(() => {
    kleuren = get_kleuren();
    if (reduced_motion == true) teken(0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  new IntersectionObserver(([entry]) => {
    zichtbaar = entry.isIntersecting;
    if (zichtbaar == true) start();
  }).observe(canvas);

  if (is_licht == true) {
    addEventListener('scroll', () => { laatste_scroll_ms = performance.now(); }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden == false) start(); });

  const hero = canvas.parentElement;
  hero.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = event.clientX - rect.left;
    cursor.y = event.clientY - rect.top;
    cursor.doel = 1;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { cursor.doel = 0; });

  start();
}
