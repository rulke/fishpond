/* 水面生物：荷花 / 浮叶 / 花瓣 / 锦鲤。导出 Life */
(function () {
  "use strict";

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (v >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((v >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (v & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }
  function svgUrl(s) {
    return "data:image/svg+xml," + encodeURIComponent(s.replace(/\s+/g, " "));
  }
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /* ---------- flowers ---------- */
  const FLOWER_SVGS = [
    (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g>${[0,1,2,3,4,5,6,7].map((i) => `<ellipse cx="50" cy="27" rx="11" ry="23" fill="${c[0]}" opacity="0.92" transform="rotate(${i*45} 50 50)"/>`).join("")}
      <circle cx="50" cy="50" r="11" fill="${c[1]}"/>
      <circle cx="50" cy="50" r="5.5" fill="${c[2]}"/></g></svg>`,
    (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g>${[0,1,2,3,4].map((i) => `<ellipse cx="50" cy="22" rx="13" ry="26" fill="${c[0]}" opacity="0.90" transform="rotate(${i*72} 50 50)"/>`).join("")}
      <circle cx="50" cy="50" r="9" fill="${c[1]}"/>
      <circle cx="50" cy="50" r="4" fill="${c[2]}"/></g></svg>`,
  ];
  const PALETTES = [
    ["#ffd6e8", "#fff3c9", "#ffe08f"],
    ["#ffe9f2", "#ffd6e0", "#ffb7c9"],
    ["#e6e0ff", "#fff0d9", "#ffd98f"],
    ["#d9f2ec", "#fffbe6", "#ffe6a3"],
    ["#ffe3d6", "#fff5e0", "#ffcf99"],
  ];

  const flowers = [];
  const FLOWER_COUNT = Math.min(8, Math.max(5, Math.floor(innerWidth / 140)));
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const el = document.createElement("img");
    const pal = PALETTES[i % PALETTES.length];
    el.src = svgUrl(pick(FLOWER_SVGS)(pal));
    el.className = "flower";
    const size = 34 + Math.random() * 30;
    el.style.width = size + "px";
    el.style.height = size + "px";
    document.body.appendChild(el);
    flowers.push({
      el, size,
      x: (0.12 + 0.76 * Math.random()) * innerWidth,
      y: (0.12 + 0.76 * Math.random()) * innerHeight,
      phase: Math.random() * Math.PI * 2,
      driftA: 6 + Math.random() * 8,
      driftS: 0.10 + Math.random() * 0.12,
      rot: Math.random() * 360,
      rotS: (Math.random() - 0.5) * 4,
    });
  }

  /* ---------- petals ---------- */
  const PETAL_COLORS = [
    ["#ffe3ee", "#ffc2d6"], ["#fff0f5", "#ffd1e0"],
    ["#f3e8ff", "#dcc9f5"], ["#fff7e8", "#ffe3b3"],
  ];
  let petalUid = 0;
  function petalSvg(c, uid) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
      <defs><linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/>
      </linearGradient></defs>
      <path d="M12 2 C20 10 21 24 12 34 C3 24 4 10 12 2 Z" fill="url(#g${uid})" opacity=".92"/>
    </svg>`;
  }
  const petals = [];
  const PETAL_COUNT = Math.min(14, Math.max(8, Math.floor(innerWidth / 90)));
  for (let i = 0; i < PETAL_COUNT; i++) {
    const el = document.createElement("img");
    el.src = svgUrl(petalSvg(PETAL_COLORS[i % PETAL_COLORS.length], petalUid++));
    el.className = "petal";
    const size = 11 + Math.random() * 9;
    el.style.width = (size * 24 / 36) + "px";
    el.style.height = size + "px";
    document.body.appendChild(el);
    petals.push({
      el, size,
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: 0, vy: 0,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 30,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function currentAt(x, y, t) {
    return {
      x: Math.sin(y * 0.0032 + t * 0.14) * 9 + Math.sin(t * 0.05 + x * 0.001) * 5,
      y: Math.cos(x * 0.0027 + t * 0.11) * 7 + Math.cos(t * 0.043) * 4,
    };
  }

  /* ---------- pads lifted from photo ---------- */
  const PAD_DEFS = [
    { cx: 0.4468, cy: 0.1830, rx: 0.0468, ry: 0.0540 },
    { cx: 0.7275, cy: 0.8361, rx: 0.0537, ry: 0.0619 },
  ];
  const pads = [];

  function padChromaMask(ctx, size, rx, ry) {
    const n = size * size, c = size / 2;
    const d = ctx.getImageData(0, 0, size, size).data;
    let m = new Uint8Array(n), cov = 0;
    for (let i = 0; i < n; i++) {
      const px = i % size, py = (i / size) | 0;
      const ex = (px - c) / (rx * 1.15), ey = (py - c) / (ry * 1.15);
      if (ex * ex + ey * ey > 1) continue;
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (g > b + 6 && g > r + 10) { m[i] = 255; cov++; }
    }
    if (cov < n * 0.04) {
      const g0 = ctx.createRadialGradient(c, c, Math.min(rx, ry) * 0.75, c, c, Math.max(rx, ry));
      g0.addColorStop(0, "rgba(0,0,0,1)");
      g0.addColorStop(0.9, "rgba(0,0,0,1)");
      g0.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = g0;
      ctx.beginPath();
      ctx.ellipse(c, c, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      return;
    }
    let a = m, b2 = new Uint8Array(n);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < size; y++) {
        const y0 = Math.max(0, y - 1), y1 = Math.min(size - 1, y + 1);
        for (let x = 0; x < size; x++) {
          let v = 0;
          const x0 = Math.max(0, x - 1), x1 = Math.min(size - 1, x + 1);
          for (let yy = y0; yy <= y1 && !v; yy++)
            for (let xx = x0; xx <= x1 && !v; xx++)
              if (a[yy * size + xx]) v = 255;
          b2[y * size + x] = v;
        }
      }
      const t = a; a = b2; b2 = t;
    }
    const mc = document.createElement("canvas");
    mc.width = size; mc.height = size;
    const mx = mc.getContext("2d");
    const mid = mx.createImageData(size, size);
    for (let i = 0; i < n; i++) mid.data[i * 4 + 3] = a[i];
    mx.putImageData(mid, 0, 0);
    const fc = document.createElement("canvas");
    fc.width = size; fc.height = size;
    const fx = fc.getContext("2d");
    fx.filter = "blur(2.5px)";
    fx.drawImage(mc, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(fc, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  function buildPads(work, wx) {
    const iw = work.width, ih = work.height;
    for (const def of PAD_DEFS) {
      const cx = def.cx * iw, cy = def.cy * ih;
      const rx = def.rx * iw, ry = def.ry * ih;
      const pad = Math.ceil(Math.max(rx, ry) * 1.25);
      const size = pad * 2;
      const spr = document.createElement("canvas");
      spr.width = size; spr.height = size;
      const sx = spr.getContext("2d", { willReadFrequently: true });
      sx.drawImage(work, cx - pad, cy - pad, size, size, 0, 0, size, size);
      padChromaMask(sx, size, rx, ry);

      const ang = Math.atan2(ih * 0.5 - cy, iw * 0.5 - cx);
      const off = Math.max(rx, ry) * 2.5;
      const ax = cx + Math.cos(ang) * off, ay = cy + Math.sin(ang) * off;
      const bx = cx + Math.cos(ang + 2.2) * off, by = cy + Math.sin(ang + 2.2) * off;
      const hpad = Math.ceil(Math.max(rx, ry) * 1.7);
      const hsize = hpad * 2;
      const heal = document.createElement("canvas");
      heal.width = hsize; heal.height = hsize;
      const hx = heal.getContext("2d");
      hx.filter = "blur(1px)";
      hx.drawImage(work, ax - hpad, ay - hpad, hsize, hsize, 0, 0, hsize, hsize);
      hx.globalAlpha = 0.5;
      hx.drawImage(work, bx - hpad, by - hpad, hsize, hsize, 0, 0, hsize, hsize);
      hx.globalAlpha = 1; hx.filter = "none";
      hx.globalCompositeOperation = "multiply";
      hx.fillStyle = "rgba(232,240,240,1)";
      hx.fillRect(0, 0, hsize, hsize);
      hx.globalCompositeOperation = "source-over";
      const g2 = hx.createRadialGradient(hpad, hpad, 0, hpad, hpad, hpad);
      g2.addColorStop(0, "rgba(0,0,0,1)");
      g2.addColorStop(0.55, "rgba(0,0,0,1)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      hx.globalCompositeOperation = "destination-in";
      hx.fillStyle = g2;
      hx.fillRect(0, 0, hsize, hsize);
      hx.globalCompositeOperation = "source-over";
      wx.drawImage(heal, cx - hpad, cy - hpad);

      const k = Math.max(innerWidth / iw, innerHeight / ih);
      const el = document.createElement("img");
      el.src = spr.toDataURL("image/png");
      el.className = "pad";
      const wCss = size * k;
      el.style.width = wCss + "px";
      el.style.height = wCss + "px";
      document.body.appendChild(el);
      const homeX = innerWidth / 2 + (cx - iw / 2) * k;
      const homeY = innerHeight / 2 + (cy - ih / 2) * k;
      const p = {
        el, w: wCss, h: wCss,
        x: homeX, y: homeY,
        homeX, homeY,
        vx: 0, vy: 0,
        rot: 0, rotV: (Math.random() - 0.5) * 3,
        phase: Math.random() * Math.PI * 2,
      };
      p.rotV0 = p.rotV;
      pads.push(p);
    }
  }

  /* ---------- koi ---------- */
  const KOI_VARIETIES = [
    { name: "kohaku", base: "#fff6ef", patches: ["#ef5a3a", "#ff7a4d"] },
    { name: "sanke", base: "#fdfcf8", patches: ["#e8482c", "#46586a"] },
    { name: "orange", base: "#ff9a52", patches: ["#ff7028", "#ffd9a8"] },
    { name: "platinum", base: "#fbfbf6", patches: ["#eef1ec", "#e6d9c2"] },
    { name: "yamabuki", base: "#ffcf6e", patches: ["#ffe4a0", "#f0ad3c"] },
    { name: "kohaku2", base: "#fff2ea", patches: ["#ff8c5a", "#ef6440"] },
    { name: "karasu", base: "#3a3d42", patches: ["#555a61", "#25272b"] },
  ];

  const BODY_D = "M30 5 C37 10 43 20 44 34 C45 48 42 60 36 70 C32 76 28 76 24 70 C18 60 15 48 16 34 C17 20 23 10 30 5 Z";
  function makeKoiEl(v, uid) {
    let blobs = "";
    const nB = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < nB; i++) {
      const col = pick(v.patches);
      const cx = rnd(17, 43), cy = rnd(10, 68);
      const rx = rnd(7, 14), ry = rnd(6, 12);
      const rot = rnd(-40, 40);
      blobs += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" transform="rotate(${rot.toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 60 130");
    svg.classList.add("koi");
    svg.innerHTML = `
      <defs>
        <clipPath id="${uid}b"><path d="${BODY_D}"/></clipPath>
        <linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${shade(v.base, -30)}"/>
          <stop offset="0.35" stop-color="${shade(v.base, 2)}"/>
          <stop offset="0.7" stop-color="${shade(v.base, 16)}"/>
          <stop offset="1" stop-color="${shade(v.base, -8)}"/>
        </linearGradient>
        <radialGradient id="${uid}s" cx="0.38" cy="0.22" r="0.55">
          <stop offset="0" stop-color="white" stop-opacity="0.16"/>
          <stop offset="0.6" stop-color="white" stop-opacity="0.03"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </radialGradient>
        <filter id="${uid}f" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.0"/>
        </filter>
      </defs>
      <path d="M29 16 C33 20 38 28 39 38 C40 46 37 54 33 60 C32 56 32 48 31 38 C30 28 29 22 29 16 Z" fill="${shade(v.base, -6)}" opacity=".32" filter="url(#${uid}f)"/>
      <g class="tail"><path d="M30 74 C34 80 39 86 38 94 C42 100 40 106 30 108 C20 106 18 100 22 94 C21 86 26 80 30 74 Z" fill="${shade(v.base, -6)}" opacity=".52" filter="url(#${uid}f)"/></g>
      <g class="finL"><path d="M18 32 C5 34 1 44 3 52 C8 49 13 44 17 38 Z" fill="${shade(v.base, -3)}" opacity=".45" filter="url(#${uid}f)"/></g>
      <g class="finR"><path d="M42 32 C55 34 59 44 57 52 C52 49 47 44 43 38 Z" fill="${shade(v.base, -3)}" opacity=".45" filter="url(#${uid}f)"/></g>
      <path d="${BODY_D}" fill="url(#${uid}g)"/>
      <path d="${BODY_D}" fill="url(#${uid}s)"/>
      <g clip-path="url(#${uid}b)">
        <g filter="url(#${uid}f)">${blobs}</g>
        <ellipse cx="30" cy="70" rx="12" ry="18" fill="#001510" opacity=".04"/>
      </g>
      <path d="M23 13 C25 18 25 26 23 33" stroke="rgba(0,0,0,0.10)" stroke-width="1.1" fill="none"/>
      <ellipse cx="21.5" cy="12.5" rx="1.8" ry="2.3" fill="#181c1e" opacity=".72"/>
      <circle cx="21" cy="11.5" r="0.8" fill="white" opacity=".75"/>
      <ellipse cx="38.5" cy="12.5" rx="1.8" ry="2.3" fill="#181c1e" opacity=".72"/>
      <circle cx="38" cy="11.5" r="0.8" fill="white" opacity=".75"/>
      <path d="M28.5 5.5 C29.5 7.5 30.5 7.5 31.5 5.5" stroke="rgba(0,0,0,0.16)" stroke-width="0.7" fill="none"/>
    `;
    return svg;
  }

  const kois = [];
  const KOI_SCALE = Math.min(1.1, Math.max(0.6, Math.min(innerWidth, innerHeight) / 760));
  const KOI_COUNT = Math.min(10, Math.max(7, Math.floor(innerWidth / 130)));
  let koiUid = 0;

  function makeKoiCommon(variety, len, big) {
    const el = makeKoiEl(variety, "k" + (koiUid++));
    el.style.width = (len * 60 / 130) + "px";
    el.style.height = len + "px";
    el.style.opacity = (0.66 + big * 0.28).toFixed(2);
    el.style.filter = `blur(${(1.2 - big * 1.0).toFixed(2)}px) saturate(${(0.9 + big * 0.16).toFixed(2)}) drop-shadow(0 ${(2 + big * 3).toFixed(0)}px ${(3 + big * 3).toFixed(0)}px rgba(30,70,90,${(0.16 + big * 0.16).toFixed(2)}))`;
    el.style.zIndex = "1";
    document.body.appendChild(el);
    return {
      el, len, big,
      heading: 0, desired: 0,
      cruise: 34 - big * 16 + Math.random() * 8,
      fright: 1.5 - big * 0.9,
      burst: 0,
      maxTurn: 1.4,
      turnV: 0, turnTarget: 0, turnT: 0,
      phase: Math.random() * Math.PI * 2,
      leader: null,
      visDeg: null, tailBucket: 0,
    };
  }

  for (let i = 0; i < KOI_COUNT; i++) {
    const variety = pick(KOI_VARIETIES);
    const t = Math.pow(Math.random(), 1.6);
    const len = (50 + t * 100) * KOI_SCALE;
    const big = t;
    const k = makeKoiCommon(variety, len, big);
    k.x = (0.12 + 0.76 * Math.random()) * innerWidth;
    k.y = (0.12 + 0.76 * Math.random()) * innerHeight;
    k.heading = k.desired = Math.random() * Math.PI * 2;
    kois.push(k);
  }
  const bigKoi = kois.filter((k) => k.big > 0.55);
  for (const k of kois) {
    if (k.big < 0.4 && bigKoi.length && Math.random() < 0.6) {
      k.leader = bigKoi[(Math.random() * bigKoi.length) | 0];
    }
  }

  function startleKoi(cx, cy) {
    for (const k of kois) {
      const d = Math.hypot(k.x - cx, k.y - cy);
      const reach = 520 * k.fright;
      if (d > reach) continue;
      if (k.burst > 50) continue;
      const w = 1 - d / reach;
      const wSq = w * w;
      const escapeH = Math.atan2(k.y - cy, k.x - cx) + (Math.random() - 0.5) * 0.5;
      k.desired += angDiff(escapeH, k.desired) * wSq;
      k.burst = Math.max(k.burst, (60 + 340 * wSq) * k.fright);
      k.maxTurn = 1.4 + wSq * 5.1;
      k.turnT = 0; k.turnV = 0; k.turnTarget = 0;
    }
  }

  function spawnKoi() {
    const side = Math.random();
    let x, y;
    if (side < 0.25) { x = rnd(-80, innerWidth + 80); y = -80; }
    else if (side < 0.5) { x = innerWidth + 80; y = rnd(-80, innerHeight + 80); }
    else if (side < 0.75) { x = rnd(-80, innerWidth + 80); y = innerHeight + 80; }
    else { x = -80; y = rnd(-80, innerHeight + 80); }
    const targetX = innerWidth * 0.3 + Math.random() * innerWidth * 0.4;
    const targetY = innerHeight * 0.3 + Math.random() * innerHeight * 0.4;
    const variety = pick(KOI_VARIETIES);
    const t = Math.pow(Math.random(), 1.6);
    const len = (50 + t * 100) * KOI_SCALE;
    const big = t;
    const k = makeKoiCommon(variety, len, big);
    k.x = x; k.y = y;
    k.heading = k.desired = Math.atan2(targetY - y, targetX - x);
    k.grace = 2.5;
    kois.push(k);
  }

  function attractKoi(tx, ty, strength) {
    for (const k of kois) {
      const want = Math.atan2(ty - k.y, tx - k.x);
      const w = Math.min(1, strength * (0.4 + k.big * 0.3));
      k.desired += angDiff(want, k.desired) * w;
      k.cruise = Math.max(k.cruise, 28 + strength * 20);
    }
  }

  function nearestKoiDist(x, y) {
    let best = Infinity;
    for (const k of kois) best = Math.min(best, Math.hypot(k.x - x, k.y - y));
    return best;
  }

  function flowerLuck(x, y) {
    let luck = 0;
    for (const f of flowers) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < 180) luck += (1 - d / 180) * 0.35;
    }
    return Math.min(1, luck);
  }

  function updateFlowers(now) {
    const Water = window.Water;
    for (const f of flowers) {
      const bx = f.x + Math.sin(now * f.driftS + f.phase) * f.driftA;
      const by = f.y + Math.cos(now * f.driftS * 0.8 + f.phase * 1.7) * f.driftA * 0.7;
      const rp = Water.rippleField(bx, by, now);
      const tx = bx + rp.dx;
      const ty = by + rp.dy;
      const bob = 1 + rp.h * 0.10 + Math.sin(now * 0.9 + f.phase) * 0.015;
      let tilt = f.rot + Math.sin(now * 0.5 + f.phase) * f.rotS * 3 + rp.dx * 0.8;
      for (const kf of kois) {
        const dx = bx - kf.x, dy = by - kf.y;
        const d = Math.hypot(dx, dy) + 1;
        const reach = f.size * 0.55 + kf.len * 0.22;
        if (d < reach) tilt += (Math.random() - 0.5) * 6 * (kf.cruise + kf.burst) / 50;
      }
      f.el.style.transform =
        `translate(${(tx - f.size / 2).toFixed(1)}px, ${(ty - f.size / 2).toFixed(1)}px) ` +
        `rotate(${tilt.toFixed(1)}deg) scale(${bob.toFixed(3)})`;
    }
  }

  function updatePads(now, dt) {
    const Water = window.Water;
    for (const p of pads) {
      const cur = currentAt(p.x, p.y, now);
      const rp = Water.rippleField(p.x, p.y, now);
      const k = Math.min(1, dt * 0.5);
      p.vx += (cur.x * 0.18 - p.vx) * k + rp.dx * dt * 7 + (p.homeX - p.x) * dt * 0.9;
      p.vy += (cur.y * 0.18 - p.vy) * k + rp.dy * dt * 7 + (p.homeY - p.y) * dt * 0.9;
      for (const kf of kois) {
        const dx = p.x - kf.x, dy = p.y - kf.y;
        const d = Math.hypot(dx, dy);
        const reach = p.w * 0.45 + kf.len * 0.25;
        if (d > 1 && d < reach) {
          const push = (kf.cruise + kf.burst) * (0.3 + kf.big * 0.6) * dt / d;
          p.vx += dx * push; p.vy += dy * push;
          p.rotV += (Math.random() - 0.5) * dt * 20;
          if (Math.random() < dt * 2) Water.addDrop(p.x + dx * 0.3, p.y + dy * 0.3, 9, 0.05 + kf.big * 0.05);
        }
      }
      p.vx *= 0.90; p.vy *= 0.90;
      p.rotV += (p.rotV0 - p.rotV) * Math.min(1, dt * 1.2);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += (p.rotV + rp.dx * 1.5) * dt;
      const bob = 1 + rp.h * 0.05 + Math.sin(now * 0.6 + p.phase) * 0.01;
      p.el.style.transform =
        `translate(${(p.x - p.w / 2).toFixed(1)}px, ${(p.y - p.h / 2).toFixed(1)}px) ` +
        `rotate(${(p.rot + Math.sin(now * 0.4 + p.phase) * 3).toFixed(1)}deg) scale(${bob.toFixed(3)})`;
    }
  }

  function updatePetals(now, dt) {
    const Water = window.Water;
    const m = 30;
    for (const p of petals) {
      const cur = currentAt(p.x, p.y, now);
      const rp = Water.rippleField(p.x, p.y, now);
      const k = Math.min(1, dt * 0.9);
      p.vx += (cur.x - p.vx) * k + rp.dx * dt * 11;
      p.vy += (cur.y - p.vy) * k + rp.dy * dt * 11;
      for (const kf of kois) {
        const dx = p.x - kf.x, dy = p.y - kf.y;
        const d = Math.hypot(dx, dy) + 0.001;
        const reach = kf.len * 0.38;
        if (d < reach) {
          const push = (kf.cruise + kf.burst) * dt / d * (0.7 + kf.big * 0.8);
          p.vx += dx * push;
          p.vy += dy * push;
          p.rotV += (Math.random() - 0.5) * dt * 60;
        }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += (p.rotV + rp.dx * 4) * dt;
      if (p.x < -m) p.x = innerWidth + m;
      else if (p.x > innerWidth + m) p.x = -m;
      if (p.y < -m) p.y = innerHeight + m;
      else if (p.y > innerHeight + m) p.y = -m;
      const bob = 1 + rp.h * 0.08 + Math.sin(now * 1.1 + p.phase) * 0.03;
      p.el.style.transform =
        `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) ` +
        `rotate(${p.rot.toFixed(1)}deg) scale(${bob.toFixed(3)})`;
    }
  }

  function updateKoi(now, dt) {
    const Water = window.Water;
    for (const k of kois) {
      k.turnT -= dt;
      if (k.turnT <= 0) {
        k.turnT = 1.5 + Math.random() * 2.5;
        k.turnTarget = (Math.random() - 0.5) * 0.8;
      }
      if (k.burst <= 40) {
        k.turnV += (k.turnTarget - k.turnV) * Math.min(1, dt * 1.2);
        const wFade = Math.min(1, (40 - k.burst) / 12);
        k.desired += k.turnV * dt * wFade;
      }
      if (k.leader && k.burst < 40) {
        const d = Math.hypot(k.leader.x - k.x, k.leader.y - k.y);
        if (d > 70) {
          const want = Math.atan2(k.leader.y - k.y, k.leader.x - k.x);
          k.desired += angDiff(want, k.desired) * Math.min(1, dt * 0.6);
        }
      }
      if (k.burst <= 40) {
        for (const other of kois) {
          if (other === k || other.burst > 40) continue;
          const dx = k.x - other.x, dy = k.y - other.y;
          const d = Math.hypot(dx, dy) + 1;
          const minDist = (k.len + other.len) * 0.28;
          if (d < minDist) k.desired += angDiff(Math.atan2(dy, dx), k.desired) * Math.min(1, dt * 0.8);
        }
      }
      if (k.grace > 0) {
        const centerH = Math.atan2(innerHeight / 2 - k.y, innerWidth / 2 - k.x);
        k.desired += angDiff(centerH, k.desired) * Math.min(1, dt * 2.5);
      }
      const em = 50;
      if (k.x < em || k.x > innerWidth - em || k.y < em || k.y > innerHeight - em) {
        const want = Math.atan2(innerHeight / 2 - k.y, innerWidth / 2 - k.x);
        k.desired += angDiff(want, k.desired) * Math.min(1, dt * 0.35);
      }
      if (k.burst > 40) k.desired += Math.sin(now * 4.5 + k.phase) * dt * 1.2;
      const dh = angDiff(k.desired, k.heading);
      const step = Math.max(-k.maxTurn * dt, Math.min(k.maxTurn * dt, dh));
      k.heading += step;
      const turnRate = step / Math.max(dt, 1e-4);
      k.maxTurn += (1.4 - k.maxTurn) * Math.min(1, dt * 1.8);
      k.burst *= Math.exp(-dt * 1.4);
      const sp = k.cruise + k.burst;
      k.x += Math.cos(k.heading) * sp * dt;
      k.y += Math.sin(k.heading) * sp * dt;
      if (k.grace > 0) k.grace -= dt;
      else {
        const OM = 140;
        if (k.x < -OM || k.x > innerWidth + OM || k.y < -OM || k.y > innerHeight + OM) k.dead = true;
      }
      if (k.burst > 70 && Math.random() < dt * 7) Water.addDrop(k.x, k.y, 11, 0.14);
      else if (k.big > 0.6 && Math.random() < dt * 0.5) Water.addDrop(k.x, k.y, 13, 0.05);
      const dur = Math.max(0.28, Math.min(1.15, 26 / sp));
      const bucket = Math.round(dur * 10);
      if (bucket !== k.tailBucket) {
        k.tailBucket = bucket;
        k.el.style.setProperty("--td", (bucket / 10) + "s");
      }
      const targetDeg = k.heading * 180 / Math.PI + 90;
      if (k.visDeg === null) k.visDeg = targetDeg;
      let vd = targetDeg - k.visDeg;
      vd = ((vd + 540) % 360) - 180;
      k.visDeg += vd * Math.min(1, dt * 9);
      const rawBank = Math.max(-16, Math.min(16, turnRate * 10));
      if (k.smoothBank === undefined) k.smoothBank = 0;
      k.smoothBank += (rawBank - k.smoothBank) * Math.min(1, dt * 8);
      const bank = k.smoothBank;
      const wig = Math.sin(now * (4 + k.cruise * 0.05) + k.phase) * (1.2 + k.len * 0.015);
      const px = k.x + Math.cos(k.heading + Math.PI / 2) * wig;
      const py = k.y + Math.sin(k.heading + Math.PI / 2) * wig;
      const w = k.len * 60 / 130;
      k.el.style.transform =
        `translate(${(px - w / 2).toFixed(1)}px, ${(py - k.len / 2).toFixed(1)}px) ` +
        `rotate(${(k.visDeg + bank).toFixed(1)}deg)`;
    }
    for (let i = kois.length - 1; i >= 0; i--) {
      if (kois[i].dead) { kois[i].el.remove(); kois.splice(i, 1); }
    }
    while (kois.length < KOI_COUNT - 1) spawnKoi();
  }

  function update(now, dt) {
    updateFlowers(now);
    updatePads(now, dt);
    updatePetals(now, dt);
    updateKoi(now, dt);
  }

  window.Life = {
    update,
    buildPads,
    startleKoi,
    attractKoi,
    nearestKoiDist,
    flowerLuck,
    flowers,
    get kois() { return kois; },
  };
})();
