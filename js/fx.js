// Lightweight particle + effect system. Everything here is purely visual:
// nothing in it affects gameplay.

const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor() {
    this.particles = [];
    this.slashes = [];
    this.popups = [];
  }

  clear() {
    this.particles.length = 0;
    this.slashes.length = 0;
    this.popups.length = 0;
  }

  add(p) {
    this.particles.push({
      vx: 0, vy: 0, gravity: 0, drag: 1, size: 10, grow: 0, rot: 0, vr: 0, alpha: 1, life: 30, ...p, age: 0,
    });
  }

  // Puff of dust at someone's feet: landing, jumping, skidding.
  dust(x, y, count = 6, spread = 1) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'puff', x: x + rand(-30, 30) * spread, y: y - rand(0, 10),
        vx: rand(-3, 3) * spread, vy: rand(-2.5, -0.5), drag: 0.9,
        size: rand(14, 26), grow: 0.6, life: rand(18, 30), color: '#e8dcc0',
      });
    }
  }

  // Bright sparks where a sword connects.
  sparks(x, y, dir = 1, count = 10, color = '#fff2b0') {
    for (let i = 0; i < count; i++) {
      const a = rand(-1.1, 1.1) + (dir < 0 ? Math.PI : 0);
      const s = rand(8, 20);
      this.add({
        type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 0.84,
        size: rand(3, 6), life: rand(10, 18), color,
      });
    }
  }

  // Sumi-ink cloud when an enemy is defeated.
  inkBurst(x, y, scale = 1) {
    const n = Math.round(12 * Math.sqrt(scale));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(3, 10) * scale;
      this.add({
        type: 'ink', x: x + rand(-20, 20), y: y + rand(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
        drag: 0.86, size: rand(14, 30) * Math.sqrt(scale), grow: 0.9, life: rand(22, 38), color: '#2b1f2a', alpha: 0.55,
      });
    }
    this.sparks(x, y, 1, 8, '#ffffff');
    this.sparks(x, y, -1, 8, '#ffffff');
  }

  sparkle(x, y, color = '#ffe680') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.add({
        type: 'star', x, y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, drag: 0.86,
        size: rand(8, 14), life: 20, color, vr: 0.2,
      });
    }
  }

  ember(x, y) {
    this.add({
      type: 'puff', x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-1, 1), vy: rand(-2, -0.5),
      size: rand(10, 20), grow: -0.4, life: rand(12, 20), color: '#ffb347', additive: true,
    });
  }

  petal(x, y, color = '#f7b7c8') {
    this.add({
      type: 'petal', x, y, vx: rand(-3.5, -1), vy: rand(1, 2.4), size: rand(9, 15), life: rand(280, 420),
      rot: rand(0, Math.PI * 2), vr: rand(-0.08, 0.08), color, wobble: rand(0, 10),
    });
  }

  // A crescent sword trail in front of the attacker.
  slash(owner, opts) {
    this.slashes.push({ owner, age: 0, life: 9, ...opts });
  }

  popup(x, y, text, color = '#fff') {
    this.popups.push({ x, y, text, color, age: 0, life: 50 });
  }

  update() {
    for (const p of this.particles) {
      p.age++;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      if (p.type === 'petal') p.vx += Math.sin((p.age + p.wobble * 10) * 0.05) * 0.08;
      p.x += p.vx;
      p.y += p.vy;
      p.size = Math.max(0, p.size + p.grow);
      p.rot += p.vr;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const s of this.slashes) s.age++;
    this.slashes = this.slashes.filter((s) => s.age < s.life);
    for (const t of this.popups) t.age++;
    this.popups = this.popups.filter((t) => t.age < t.life);
  }

  draw(ctx, layer = 'front') {
    for (const p of this.particles) {
      const isBack = p.type === 'petal' && p.back;
      if ((layer === 'back') !== isBack) continue;
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = p.alpha * (1 - t * t);
      if (p.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.type === 'spark') {
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 1.6, -p.vy * 1.6);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? p.size * 0.35 : p.size;
          const a = (i / 8) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.fill();
      } else if (p.type === 'petal') {
        ctx.globalAlpha = Math.min(1, (p.life - p.age) / 40) * 0.9;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (layer !== 'front') return;

    for (const s of this.slashes) {
      const t = s.age / s.life;
      const { owner } = s;
      const cx = owner.centerX + (s.offsetX ?? 0) * owner.facing;
      const cy = owner.y + (s.offsetY ?? owner.h * 0.45);
      const r = s.radius;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(owner.facing, 1);
      ctx.globalAlpha = (1 - t) * 0.95;
      const start = -1.25 + t * 0.35;
      const end = 1.0 + t * 0.15;
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, s.color ?? 'rgba(255,255,255,0)');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, s.color ?? 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, start, end);
      ctx.arc(r * 0.22, 0, r * 0.82, end, start, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.popups) {
      const k = t.age / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '58px "Yuji Syuku", serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#1b1210';
      ctx.fillStyle = t.color;
      const y = t.y - Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 70;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillText(t.text, t.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
