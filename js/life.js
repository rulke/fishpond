/* 水面生物：荷花 / 浮叶 / 花瓣 / 九种塘鱼。导出 Life */
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
  function pickWeighted(entries) {
    // entries: [{ v, w }]
    let sum = 0;
    for (const e of entries) sum += e.w;
    let t = Math.random() * sum;
    for (const e of entries) { t -= e.w; if (t <= 0) return e.v; }
    return entries[entries.length - 1].v;
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

  /* ---------- 九种塘鱼 ----------
     渲染复用锦鲤参数化形体；稀有度权重控制出现；个体可被指派咬钩任务。 */
  const POND_SPECIES = [
    { id: "crucian",  w: 58,  len: [40, 70],
      skins: [{ base: "#c9d6c2", patches: ["#8fad8a", "#a8c0a0"] }],
      shape: { sx: 0.82 }, spd: 1 },
    { id: "loach",    w: 58,  len: [30, 55],
      skins: [{ base: "#8b7355", patches: ["#5c4a32"] }],
      shape: { sx: 0.48, tail: "long" }, spd: 0.72, bottom: true },
    { id: "bream",    w: 58,  len: [45, 75],
      skins: [{ base: "#d8e2ea", patches: ["#9aafc0", "#b8c8d4"] }],
      shape: { sx: 1.12 }, spd: 0.95 },
    { id: "carp",     w: 26,  len: [90, 150],
      skins: [
        { base: "#ff9a52", patches: ["#ff7028", "#ffd9a8"] },
        { base: "#ffcf6e", patches: ["#ffe4a0", "#f0ad3c"] },
      ],
      shape: { sx: 1.05 }, spd: 0.88 },
    { id: "goldfish", w: 26,  len: [35, 60],
      skins: [{ base: "#ff9a52", patches: ["#ff7028", "#ffd9a8"] }],
      shape: { sx: 1.32, tail: "big" }, spd: 0.9 },
    { id: "koi",      w: 12,  len: [100, 150],
      skins: [
        { base: "#fff6ef", patches: ["#ef5a3a", "#ff7a4d"] },
        { base: "#fff2ea", patches: ["#ff8c5a", "#ef6440"] },
        { base: "#fdfcf8", patches: ["#e8482c", "#46586a"] },
      ],
      shape: { sx: 1 }, spd: 0.85 },
    { id: "puffer",   w: 12,  len: [45, 80],
      skins: [{ base: "#e8d9a8", patches: ["#c4a86a", "#b8c48f"] }],
      shape: { sx: 1.45, tail: "tiny" }, spd: 0.6, puff: true },
    { id: "moon",     w: 3.2, len: [70, 110],
      skins: [{ base: "#d4e8f5", patches: ["#7a9bb8", "#a8cce0"] }],
      shape: { sx: 0.45, tail: "long" }, spd: 1.1, glow: true, max: 1 },
    { id: "lotus",    w: 0.8, len: [25, 40],
      skins: [{ base: "#ffd6e8", patches: ["#fff3c9"] }],
      shape: { kind: "sprite" }, spd: 0.8, glow: true, flower: true, max: 1 },
  ];
  const spById = {};
  for (const s of POND_SPECIES) spById[s.id] = s;

  const BODY_D = "M30 5 C37 10 43 20 44 34 C45 48 42 60 36 70 C32 76 28 76 24 70 C18 60 15 48 16 34 C17 20 23 10 30 5 Z";
  function makeFishEl(sp, skin, uid) {
    const shape = sp.shape || {};
    if (shape.kind === "sprite") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 40 40");
      svg.classList.add("koi", "sprite");
      svg.innerHTML = `
        <defs>
          <radialGradient id="${uid}g" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stop-color="${skin.base}"/>
            <stop offset="1" stop-color="${skin.patches[0]}" stop-opacity="0"/>
          </radialGradient>
          <filter id="${uid}f" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4"/>
          </filter>
        </defs>
        <circle cx="20" cy="19" r="18" fill="url(#${uid}g)" opacity=".5"/>
        <g class="tail"><path d="M20 24 C24 28 26 33 24 37 C21 35 19 35 16 37 C14 33 16 28 20 24 Z" fill="${skin.patches[0]}" opacity=".55" filter="url(#${uid}f)"/></g>
        <path d="M20 8 C26 13 27 20 20 26 C13 20 14 13 20 8 Z" fill="${skin.base}" opacity=".95"/>
        <path d="M20 10 C24 14 25 19 20 24" stroke="${skin.patches[0]}" stroke-width=".8" fill="none" opacity=".5"/>
        <circle cx="20" cy="15" r="1.6" fill="#fff" opacity=".85"/>
      `;
      return svg;
    }
    const sx = shape.sx || 1;
    const tail = shape.tail || "normal";
    const tailY = tail === "long" ? 1.3 : tail === "big" ? 1.5 : tail === "tiny" ? 0.55 : 1;
    const finS = tail === "tiny" ? 0.7 : tail === "big" ? 1.1 : 1;
    const blobs = [];
    const nB = skin.patches.length > 1 ? 2 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < nB; i++) {
      const col = pick(skin.patches);
      const cx = rnd(17, 43), cy = rnd(10, 68);
      const rx = rnd(7, 14), ry = rnd(6, 12);
      const rot = rnd(-40, 40);
      blobs.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" transform="rotate(${rot.toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`);
    }
    const exL = (30 - 8.5 * sx).toFixed(1), exR = (30 + 8.5 * sx).toFixed(1);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 60 130");
    svg.classList.add("koi");
    svg.innerHTML = `
      <defs>
        <clipPath id="${uid}b"><path d="${BODY_D}"/></clipPath>
        <linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${shade(skin.base, -30)}"/>
          <stop offset="0.35" stop-color="${shade(skin.base, 2)}"/>
          <stop offset="0.7" stop-color="${shade(skin.base, 16)}"/>
          <stop offset="1" stop-color="${shade(skin.base, -8)}"/>
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
      <g transform="translate(30 0) scale(${sx} 1) translate(-30 0)">
        <path d="M29 16 C33 20 38 28 39 38 C40 46 37 54 33 60 C32 56 32 48 31 38 C30 28 29 22 29 16 Z" fill="${shade(skin.base, -6)}" opacity=".32" filter="url(#${uid}f)"/>
        <g class="tail" transform="translate(30 74) scale(1 ${tailY}) translate(-30 -74)"><path d="M30 74 C34 80 39 86 38 94 C42 100 40 106 30 108 C20 106 18 100 22 94 C21 86 26 80 30 74 Z" fill="${shade(skin.base, -6)}" opacity=".52" filter="url(#${uid}f)"/></g>
        <g class="finL" transform="translate(18 32) scale(${finS}) translate(-18 -32)"><path d="M18 32 C5 34 1 44 3 52 C8 49 13 44 17 38 Z" fill="${shade(skin.base, -3)}" opacity=".45" filter="url(#${uid}f)"/></g>
        <g class="finR" transform="translate(42 32) scale(${finS}) translate(-42 -32)"><path d="M42 32 C55 34 59 44 57 52 C52 49 47 44 43 38 Z" fill="${shade(skin.base, -3)}" opacity=".45" filter="url(#${uid}f)"/></g>
        <path d="${BODY_D}" fill="url(#${uid}g)"/>
        <path d="${BODY_D}" fill="url(#${uid}s)"/>
        <g clip-path="url(#${uid}b)">
          <g filter="url(#${uid}f)">${blobs.join("")}</g>
          <ellipse cx="30" cy="70" rx="12" ry="18" fill="#001510" opacity=".04"/>
        </g>
      </g>
      <path d="M${(30 - 7 * sx).toFixed(1)} 13 C${(30 - 5 * sx).toFixed(1)} 18 ${(30 - 5 * sx).toFixed(1)} 26 ${(30 - 7 * sx).toFixed(1)} 33" stroke="rgba(0,0,0,0.10)" stroke-width="1.1" fill="none"/>
      <ellipse cx="${exL}" cy="12.5" rx="1.8" ry="2.3" fill="#181c1e" opacity=".72"/>
      <circle cx="${(+exL - 0.5).toFixed(1)}" cy="11.5" r="0.8" fill="white" opacity=".75"/>
      <ellipse cx="${exR}" cy="12.5" rx="1.8" ry="2.3" fill="#181c1e" opacity=".72"/>
      <circle cx="${(+exR - 0.5).toFixed(1)}" cy="11.5" r="0.8" fill="white" opacity=".75"/>
      <path d="M28.5 5.5 C29.5 7.5 30.5 7.5 31.5 5.5" stroke="rgba(0,0,0,0.16)" stroke-width="0.7" fill="none"/>
    `;
    return svg;
  }

  const kois = [];
  const KOI_SCALE = Math.min(1.1, Math.max(0.6, Math.min(innerWidth, innerHeight) / 760));
  const POP = Math.max(10, Math.min(14, Math.round(innerWidth / 110)));
  let koiUid = 0;

  function countSp(id) {
    let n = 0;
    for (const k of kois) if (k.spId === id) n++;
    return n;
  }

  function rollSpecies() {
    // 稀有度权重决定塘里住谁；月华/传说受 max 与荷塘限制
    const entries = [];
    for (const s of POND_SPECIES) {
      if (s.max && countSp(s.id) >= s.max) continue;
      entries.push({ v: s, w: s.w });
    }
    if (!entries.length) return spById.crucian;
    return pickWeighted(entries);
  }

  function makeKoiCommon(sp, len) {
    const skin = pick(sp.skins);
    const el = makeFishEl(sp, skin, "k" + (koiUid++));
    el.style.width = (len * 60 / 130) + "px";
    el.style.height = len + "px";
    const big = Math.max(0, Math.min(1, (len - sp.len[0]) / (sp.len[1] - sp.len[0])));
    el.style.opacity = (0.66 + big * 0.28).toFixed(2);
    let filter = `blur(${(1.2 - big * 1.0).toFixed(2)}px) saturate(${(0.9 + big * 0.16).toFixed(2)}) drop-shadow(0 ${(2 + big * 3).toFixed(0)}px ${(3 + big * 3).toFixed(0)}px rgba(30,70,90,${(0.16 + big * 0.16).toFixed(2)}))`;
    if (sp.glow) filter += " drop-shadow(0 0 6px rgba(190,225,255,.45))";
    el.style.filter = filter;
    el.style.zIndex = "1";
    document.body.appendChild(el);
    return {
      el, len, big, spId: sp.id, sp,
      heading: 0, desired: 0,
      cruise: (34 - big * 16 + Math.random() * 8) * sp.spd,
      fright: 1.5 - big * 0.9,
      burst: 0,
      maxTurn: 1.4,
      turnV: 0, turnTarget: 0, turnT: 0,
      phase: Math.random() * Math.PI * 2,
      leader: null,
      visDeg: null, tailBucket: 0,
      job: null, jobSpd: 0, bubbleT: 0, hidden: false,
    };
  }

  function spawnAt(sp, x, y, towardCenter) {
    const len = rnd(sp.len[0], sp.len[1]) * KOI_SCALE;
    const k = makeKoiCommon(sp, len);
    k.x = x; k.y = y;
    const tx = towardCenter ? innerWidth * (0.3 + Math.random() * 0.4) : innerWidth / 2;
    const ty = towardCenter ? innerHeight * (0.3 + Math.random() * 0.4) : innerHeight / 2;
    k.heading = k.desired = Math.atan2(ty - y, tx - x);
    k.grace = 2.5;
    kois.push(k);
    return k;
  }

  function spawnKoi() {
    const side = Math.random();
    let x, y;
    if (side < 0.25) { x = rnd(-80, innerWidth + 80); y = -80; }
    else if (side < 0.5) { x = innerWidth + 80; y = rnd(-80, innerHeight + 80); }
    else if (side < 0.75) { x = rnd(-80, innerWidth + 80); y = innerHeight + 80; }
    else { x = -80; y = rnd(-80, innerHeight + 80); }
    const sp = rollSpecies();
    if (sp.flower && flowers.length) {
      const f = pick(flowers);
      x = f.x + rnd(-70, 70); y = f.y + rnd(-70, 70);
    }
    return spawnAt(sp, x, y, true);
  }

  // 初始塘：按权重铺满
  for (let i = 0; i < POP; i++) {
    const sp = rollSpecies();
    let x = (0.12 + 0.76 * Math.random()) * innerWidth;
    let y = (0.12 + 0.76 * Math.random()) * innerHeight;
    if (sp.flower && flowers.length) { const f = pick(flowers); x = f.x + rnd(-70, 70); y = f.y + rnd(-70, 70); }
    if (sp.bottom) y = Math.max(y, innerHeight * 0.55);
    spawnAt(sp, x, y, false);
  }
  const bigKoi = kois.filter((k) => k.big > 0.55);
  for (const k of kois) {
    if (k.big < 0.4 && bigKoi.length && Math.random() < 0.6) {
      k.leader = bigKoi[(Math.random() * bigKoi.length) | 0];
    }
  }

  function startleKoi(cx, cy) {
    for (const k of kois) {
      if (k.job) continue; // 执行任务的鱼不受惊
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

  /* ---------- 咬钩任务系统：把"看得见的鱼"变成"咬钩的鱼" ---------- */
  let jobKoi = null;

  function pickCandidate(baitId, x, y, boost) {
    const sps = (window.Fishing && Fishing.getSpecies()) || [];
    const spBait = {};
    for (const s of sps) spBait[s.id] = s.baits.includes(baitId);
    const matches = kois.filter((k) => spBait[k.spId] && !k.job);
    if (!matches.length) return null;
    return pickWeighted(matches.map((k) => {
      const sp = spById[k.spId];
      const d = Math.hypot(k.x - x, k.y - y);
      return { v: k, w: (sp ? sp.w : 30) * (1 + (boost || 0)) / (1 + d / 400) };
    }));
  }

  function beginApproach(baitId, x, y, boost) {
    if (jobKoi && jobKoi.job) return jobKoi;
    const k = pickCandidate(baitId, x, y, boost);
    if (!k) return null;
    k.job = { kind: "approach", x, y, t: 0 };
    k.jobSpd = 0;
    jobKoi = k;
    return k;
  }

  function assignNearest(x, y) {
    if (jobKoi && jobKoi.job) return jobKoi;
    let best = null, bd = Infinity;
    for (const k of kois) {
      if (k.job) continue;
      const d = Math.hypot(k.x - x, k.y - y);
      if (d < bd) { bd = d; best = k; }
    }
    if (!best) return null;
    best.job = { kind: "circle", x, y, t: 0 };
    jobKoi = best;
    return best;
  }

  function ensureCandidate(baitId) {
    const sps = (window.Fishing && Fishing.getSpecies()) || [];
    const fit = sps.filter((s) => s.baits.includes(baitId));
    if (!fit.length) return null;
    // 已有候选就不重复刷
    for (const k of kois) {
      if (k.job) continue;
      const sp = fit.find((s) => s.id === k.spId);
      if (sp) return null;
    }
    const sp = pickWeighted(fit.map((s) => ({ v: s, w: s.w || 30 })));
    const def = spById[sp.id];
    if (def.max && countSp(def.id) >= def.max) return null;
    const side = Math.random();
    let x, y;
    if (side < 0.5) { x = -60; y = rnd(0.2, 0.7) * innerHeight; }
    else { x = innerWidth + 60; y = rnd(0.2, 0.7) * innerHeight; }
    return spawnAt(def, x, y, true);
  }

  function setJob(kind) {
    if (!jobKoi || !jobKoi.job) return;
    if (jobKoi.job.kind === "leap") return;
    jobKoi.job.kind = kind;
    jobKoi.job.t = 0;
  }

  function fleeBait() {
    if (jobKoi && jobKoi.job) {
      const k = jobKoi;
      k.job = null;
      startleKoi(k.x, k.y);
    }
    jobKoi = null;
  }

  function leapCatch() {
    if (!jobKoi) return;
    const k = jobKoi;
    k.job = { kind: "leap", t: 0,
      fx: k.x, fy: k.y,
      tx: innerWidth / 2, ty: innerHeight - 170 };
    k.hidden = false;
  }

  function releaseCurrent() {
    if (!jobKoi) return;
    const k = jobKoi;
    k.job = null;
    k.hidden = false;
    k.x = innerWidth / 2; k.y = innerHeight - 150;
    k.grace = 1.5;
    const h = Math.atan2(innerHeight * 0.4 - k.y, innerWidth * 0.45 - k.x);
    k.heading = k.desired = h;
    k.burst = 260;
    jobKoi = null;
  }

  function removeCurrent() {
    if (!jobKoi) return;
    const i = kois.indexOf(jobKoi);
    if (i >= 0) { kois[i].el.remove(); kois.splice(i, 1); }
    jobKoi = null;
  }

  function disperse() {
    if (jobKoi && jobKoi.job) jobKoi.job = null;
    jobKoi = null;
  }

  function jobSteer(k, now, dt) {
    const job = k.job;
    job.t += dt;
    const st = window.Fishing ? Fishing.st : null;
    k.bubbleT -= dt;
    let tx = k.x, ty = k.y, spd = 70;

    if (job.kind === "approach") {
      // 三段渐近：远巡 → 靠近 → 悬在饵旁
      const u = Math.min(1, job.t / 4.5);
      const r = 150 * (1 - u) + 44;
      const a = now * 0.7 + k.phase;
      tx = job.x + Math.cos(a) * r;
      ty = job.y + Math.sin(a) * r * 0.72;
      spd = 60 + u * 60;
    } else if (job.kind === "circle") {
      const r = 34 + Math.sin(now * 1.7 + k.phase) * 8;
      const a = now * 1.15 + k.phase;
      tx = job.x + Math.cos(a) * r;
      ty = job.y + Math.sin(a) * r * 0.72;
      spd = 95;
    } else if (job.kind === "lunge") {
      tx = job.x; ty = job.y;
      spd = 430;
    } else if (job.kind === "hooked") {
      const surge = Math.max(0, Math.sin((st && st.fightPhase || 0) * 2.2)) ** 2;
      const prog = st ? st.fightProgress : 0;
      const r = 30 + (1 - prog) * 34 + surge * 26;
      const a = now * (1.6 + surge * 3.2) + k.phase;
      tx = job.x + Math.cos(a) * r;
      ty = job.y + Math.sin(a) * r * 0.75;
      spd = 120 + surge * 260;
    } else if (job.kind === "leap") {
      const u = Math.min(1, job.t / 0.55);
      const e = u * u * (3 - 2 * u);
      k.x = job.fx + (job.tx - job.fx) * e;
      k.y = job.fy + (job.ty - job.fy) * e - Math.sin(u * Math.PI) * 130;
      k.heading = Math.atan2(job.ty - job.fy, job.tx - job.fx);
      const keep = u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.15);
      k.el.style.opacity = (0.9 * keep).toFixed(2);
      if (u >= 1) { k.hidden = true; k.el.style.opacity = "0"; }
      return;
    }

    if (job.kind !== "lunge" || Math.hypot(tx - k.x, ty - k.y) > 6) {
      const dx = tx - k.x, dy = ty - k.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const want = Math.atan2(dy, dx);
        k.desired += angDiff(want, k.desired) * Math.min(1, dt * 6);
      }
    }
    k.jobSpd = spd;
    // 靠近饵的鱼搅水吐泡，玩家由此认出"是它"
    if (k.bubbleT <= 0 && job.kind !== "leap" && window.Water) {
      Water.addDrop(k.x, k.y, 4.5, 0.12);
      k.bubbleT = 0.45 + Math.random() * 0.5;
    }
  }

  function updateKoi(now, dt) {
    const Water = window.Water;
    for (const k of kois) {
      if (k.hidden) continue;
      if (k.job) {
        jobSteer(k, now, dt);
      } else {
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
        // 泥鳅恋底；荷心精灵恋花
        const sp = k.sp;
        if (sp.bottom && k.y < innerHeight * 0.55) {
          k.desired += angDiff(Math.PI / 2, k.desired) * Math.min(1, dt * 0.25);
        }
        if (sp.flower && flowers.length) {
          let nf = null, nd = Infinity;
          for (const f of flowers) {
            const d = Math.hypot(f.x - k.x, f.y - k.y);
            if (d < nd) { nd = d; nf = f; }
          }
          if (nf && nd > 160) {
            const want = Math.atan2(nf.y - k.y, nf.x - k.x);
            k.desired += angDiff(want, k.desired) * Math.min(1, dt * 0.5);
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
      }

      const dh = angDiff(k.desired, k.heading);
      const step = Math.max(-k.maxTurn * dt, Math.min(k.maxTurn * dt, dh));
      k.heading += step;
      const turnRate = step / Math.max(dt, 1e-4);
      k.maxTurn += (1.4 - k.maxTurn) * Math.min(1, dt * 1.8);
      k.burst *= Math.exp(-dt * 1.4);
      const sp = k.job ? k.jobSpd : k.cruise + k.burst;
      k.x += Math.cos(k.heading) * sp * dt;
      k.y += Math.sin(k.heading) * sp * dt;
      if (k.grace > 0) k.grace -= dt;
      else if (!k.job) {
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
      // 河豚被钩住会鼓气
      let sc = 1;
      if (k.sp.puff && k.job && k.job.kind === "hooked") sc = 1 + Math.min(0.3, k.job.t * 0.2);
      k.el.style.transform =
        `translate(${(px - w / 2).toFixed(1)}px, ${(py - k.len / 2).toFixed(1)}px) ` +
        `rotate(${(k.visDeg + bank).toFixed(1)}deg) scale(${sc.toFixed(2)})`;
    }
    for (let i = kois.length - 1; i >= 0; i--) {
      if (kois[i].dead) { kois[i].el.remove(); kois.splice(i, 1); }
    }
    while (kois.length < POP - 1) spawnKoi();
  }

  // 稀有鱼保底目击：每隔一阵请一位珍客入园
  let rareVisitT = 40 + Math.random() * 40;
  function updateRareVisit(dt) {
    rareVisitT -= dt;
    if (rareVisitT > 0) return;
    rareVisitT = 45 + Math.random() * 45;
    const rares = POND_SPECIES.filter((s) => s.w <= 12 && (!s.max || countSp(s.id) < s.max));
    if (!rares.length) return;
    const sp = pickWeighted(rares.map((s) => ({ v: s, w: s.w })));
    let x = -60, y = rnd(0.25, 0.65) * innerHeight;
    if (sp.flower && flowers.length) { const f = pick(flowers); x = f.x + rnd(-70, 70); y = f.y + rnd(-70, 70); }
    else if (Math.random() < 0.5) x = innerWidth + 60;
    spawnAt(sp, x, y, true);
  }

  function attractKoi(tx, ty, strength) {
    for (const k of kois) {
      if (k.job) continue;
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
        `translate(${(p.x - p.w / 2).toFixed(1)}px, ${(p.y - p.w / 2).toFixed(1)}px) ` +
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

  function update(now, dt) {
    updateFlowers(now);
    updatePads(now, dt);
    updatePetals(now, dt);
    updateKoi(now, dt);
    updateRareVisit(dt);
  }

  window.Life = {
    update,
    buildPads,
    startleKoi,
    attractKoi,
    nearestKoiDist,
    flowerLuck,
    flowers,
    beginApproach,
    ensureCandidate,
    assignNearest,
    circleBait: () => setJob("circle"),
    lungeBait: () => setJob("lunge"),
    hookActive: () => setJob("hooked"),
    fleeBait,
    leapCatch,
    releaseCurrent,
    removeCurrent,
    disperse,
    currentKoi: () => jobKoi,
    get kois() { return kois; },
  };
})();
