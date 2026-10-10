// Image analysis + procedurally drawn stand-in art.
//
// Several asset files are still flat "label" placeholders (a solid box with
// its filename printed on it). isPlaceholder() spots those automatically, and
// buildArt() in assets.js swaps in the hand-coded stand-ins below instead -
// so as soon as a real PNG is dropped in at the same path, the game starts
// using it with no code changes.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const analysisCanvas = makeCanvas(48, 48);
const analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });

// True when more than half of the image's opaque pixels share one flat color
// - i.e. a generated label box, not painted art.
export function isPlaceholder(img) {
  if (!img || !img.width) return true;
  analysisCtx.clearRect(0, 0, 48, 48);
  analysisCtx.drawImage(img, 0, 0, 48, 48);
  const { data } = analysisCtx.getImageData(0, 0, 48, 48);
  const counts = new Map();
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    opaque++;
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (opaque === 0) return true;
  let best = 0;
  for (const n of counts.values()) best = Math.max(best, n);
  return best / opaque > 0.5;
}

const metaCache = new WeakMap();

// Bounding box of the image's visible (non-transparent) pixels, in the
// image's own pixel space - used to stand a sprite's painted feet exactly on
// its collision box's bottom edge, whatever padding the file has.
export function opaqueBounds(img) {
  if (metaCache.has(img)) return metaCache.get(img);
  const w = img.width;
  const h = img.height;
  const sample = Math.min(1, 256 / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * sample));
  const sh = Math.max(1, Math.round(h * sample));
  const c = makeCanvas(sw, sh);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const meta = maxX < 0
    ? { left: 0, top: 0, right: w, bottom: h }
    : {
      left: minX / sample,
      top: minY / sample,
      right: (maxX + 1) / sample,
      bottom: (maxY + 1) / sample,
    };
  meta.width = meta.right - meta.left;
  meta.height = meta.bottom - meta.top;
  metaCache.set(img, meta);
  return meta;
}

export function mirror(img) {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.translate(img.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0);
  return c;
}

// Recolors an image toward `color` (keeping its shading and alpha) - used to
// give each boss fight a distinct palette while they share stand-in art.
export function tint(img, color, strength = 0.6) {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  return c;
}

// A flat white silhouette of an image - drawn over a sprite for hit flashes.
export function silhouette(img, color = '#fff') {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Fades the top portion of an image to transparent, so a painted backdrop
// (which has its own sky baked in) blends into the game's sky gradient.
export function fadeTop(img, fraction = 0.4) {
  const c = makeCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createLinearGradient(0, 0, 0, img.height * fraction);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, img.height * fraction);
  return c;
}

// Mirrors every other copy so a non-tiling painting still loops seamlessly.
// A few edge columns are trimmed first - scanned prints often have a border.
export function seamless(img, trim = 4) {
  const w = img.width - trim * 2;
  const c = makeCanvas(w * 2, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, trim, 0, w, img.height, 0, 0, w, img.height);
  ctx.translate(w * 2, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, trim, 0, w, img.height, 0, 0, w, img.height);
  return c;
}

// The image with a solid ink outline around its silhouette, so painted
// characters pop against equally painterly backgrounds. The result is also
// downscaled to at most `maxHeight` pixels tall (character art is drawn far
// smaller than its source resolution, so there's no point keeping it huge).
// `thickness` is in the source image's pixels. The returned canvas carries
// `pad` (outline margin, in source pixels) and `k` (its downscale factor).
export function outlined(img, thickness, color = '#1b1210', maxHeight = 420) {
  const k = Math.min(1, maxHeight / img.height);
  const pad = Math.ceil(thickness) + 2;
  const c = makeCanvas(Math.ceil((img.width + pad * 2) * k), Math.ceil((img.height + pad * 2) * k));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const w = img.width * k;
  const h = img.height * k;
  const sil = silhouette(img, color);
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(sil, (pad + Math.cos(a) * thickness) * k, (pad + Math.sin(a) * thickness) * k, w, h);
  }
  ctx.drawImage(img, pad * k, pad * k, w, h);
  c.pad = pad;
  c.k = k;
  return c;
}

// ---------------------------------------------------------------------------
// Procedural stand-ins
// ---------------------------------------------------------------------------

const INK = '#2a1a14';

// Edo-style mon coin: gold disc with a square hole, 4 spin frames.
export function drawCoinFrames() {
  const size = 140;
  const widths = [1, 0.7, 0.22, 0.7];
  return widths.map((sx, i) => {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(sx, 1);
    const r = size * 0.44;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff6c2');
    g.addColorStop(0.45, '#f2c445');
    g.addColorStop(1, '#a8701a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(120,70,10,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    if (i !== 2) {
      ctx.fillStyle = INK;
      ctx.fillRect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, -r * 0.45, r * 0.16, r * 0.08, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  });
}

export function drawFireball() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.25, 'rgba(255,220,90,1)');
  g.addColorStop(0.55, 'rgba(255,110,30,0.9)');
  g.addColorStop(1, 'rgba(200,30,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Exit: a dark wooden gate with glowing shoji panels under a small roof.
// Shop: an open doorway hung with an indigo noren curtain.
export function drawDoor(kind) {
  const w = 300;
  const h = 600;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';

  // Frame posts and lintel
  ctx.fillStyle = '#b5321f';
  ctx.fillRect(14, 70, 34, h - 70);
  ctx.fillRect(w - 48, 70, 34, h - 70);
  ctx.fillRect(0, 50, w, 40);
  ctx.fillStyle = '#7d1f12';
  ctx.fillRect(0, 84, w, 10);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 70, 34, h - 72);
  ctx.strokeRect(w - 48, 70, 34, h - 72);
  ctx.strokeRect(0, 50, w, 40);

  // Little tiled roof cap
  ctx.fillStyle = '#3c4a3f';
  ctx.beginPath();
  ctx.moveTo(-10, 56);
  ctx.quadraticCurveTo(w / 2, 10, w + 10, 56);
  ctx.lineTo(w - 20, 0);
  ctx.lineTo(20, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const innerX = 48;
  const innerW = w - 96;
  const innerY = 94;
  const innerH = h - innerY;

  if (kind === 'shop') {
    // Warm interior glow
    const g = ctx.createLinearGradient(0, innerY, 0, h);
    g.addColorStop(0, '#ffcf73');
    g.addColorStop(1, '#8a4a1c');
    ctx.fillStyle = g;
    ctx.fillRect(innerX, innerY, innerW, innerH);
    // Noren: three indigo panels with a white crest
    const panelW = innerW / 3;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 1 ? '#22336b' : '#2b3f80';
      ctx.fillRect(innerX + i * panelW + 2, innerY, panelW - 4, 230);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(innerX + i * panelW + 2, innerY, panelW - 4, 230);
    }
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.arc(w / 2, innerY + 120, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b3f80';
    ctx.font = 'bold 54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('店', w / 2, innerY + 122);
  } else {
    // Sliding wooden doors with paper panes
    ctx.fillStyle = '#4a2c1a';
    ctx.fillRect(innerX, innerY, innerW, innerH);
    const paneW = (innerW - 30) / 2;
    for (let d = 0; d < 2; d++) {
      const x0 = innerX + 10 + d * (paneW + 10);
      const g = ctx.createLinearGradient(0, innerY, 0, h);
      g.addColorStop(0, '#fff3cf');
      g.addColorStop(1, '#f1c779');
      ctx.fillStyle = g;
      ctx.fillRect(x0, innerY + 16, paneW, innerH - 50);
      ctx.strokeStyle = '#4a2c1a';
      ctx.lineWidth = 6;
      for (let r = 1; r < 6; r++) {
        const y = innerY + 16 + (r * (innerH - 50)) / 6;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + paneW, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x0 + paneW / 2, innerY + 16);
      ctx.lineTo(x0 + paneW / 2, innerY + innerH - 34);
      ctx.stroke();
    }
  }
  return c;
}

// Chochin-obake: a haunted paper lantern with one eye and a lolling tongue.
// `pose`: 'idle' | 'windup' (glowing, eye wide) | 'cast' (mouth open, spitting).
export function drawLantern(pose) {
  const w = 220;
  const h = 300;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const cx = w / 2;
  const glow = pose === 'idle' ? 0.25 : pose === 'windup' ? 0.75 : 1;

  if (glow > 0.3) {
    const halo = ctx.createRadialGradient(cx, h * 0.55, 20, cx, h * 0.55, w * 0.55);
    halo.addColorStop(0, `rgba(255,190,80,${0.55 * glow})`);
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  }

  // Caps
  ctx.fillStyle = '#2b2018';
  ctx.fillRect(cx - 48, 16, 96, 26);
  ctx.fillRect(cx - 44, h - 46, 88, 24);
  ctx.fillRect(cx - 6, 0, 12, 18);

  // Paper body
  const body = ctx.createRadialGradient(cx - 20, h * 0.45, 10, cx, h * 0.55, 110);
  body.addColorStop(0, glow > 0.5 ? '#fff0a8' : '#ffd77a');
  body.addColorStop(0.6, '#f08a3a');
  body.addColorStop(1, '#a8361a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.53, 92, 112, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Ribs
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(70,30,10,0.55)';
  for (let i = -4; i <= 4; i++) {
    const y = h * 0.53 + i * 22;
    const half = 92 * Math.sqrt(Math.max(0, 1 - ((i * 22) / 112) ** 2));
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.quadraticCurveTo(cx, y + 8, cx + half, y);
    ctx.stroke();
  }

  // Torn paper split - the mouth
  const mouthOpen = pose === 'cast' ? 34 : pose === 'windup' ? 12 : 6;
  const my = h * 0.66;
  ctx.fillStyle = '#3a0d08';
  ctx.beginPath();
  ctx.moveTo(cx - 58, my);
  ctx.quadraticCurveTo(cx, my - 14, cx + 58, my);
  ctx.quadraticCurveTo(cx, my + mouthOpen + 12, cx - 58, my);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Tongue
  ctx.fillStyle = '#e0405a';
  ctx.beginPath();
  ctx.moveTo(cx - 10, my + 4);
  ctx.quadraticCurveTo(cx + 26, my + 40 + mouthOpen, cx + 8, my + 70 + mouthOpen);
  ctx.quadraticCurveTo(cx - 14, my + 40, cx - 10, my + 4);
  ctx.fill();
  ctx.stroke();

  // One big eye
  const ey = h * 0.42;
  const er = pose === 'windup' ? 32 : 26;
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath();
  ctx.ellipse(cx + 6, ey, er, er * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx + 14, ey + 2, er * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + 9, ey - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
