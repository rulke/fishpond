/* UI 组装：扇面拖抛、青瓷冰裂、全物态反馈（无飘字）。导出 App */
(function () {
  "use strict";

  const SAVE_KEY = "fishpond_save_v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    baitBar: $("baitBar"),
    baitTag: $("baitTag"),
    card: $("catchCard"),
    cardFish: $("cardFish"),
    cardName: $("cardName"),
    cardMeta: $("cardMeta"),
    cardPoem: $("cardPoem"),
    cardRarity: $("cardRarity"),
    cardBadge: $("cardBadge"),
    btnKeep: $("btnKeep"),
    btnRelease: $("btnRelease"),
    journalBtn: $("journalBtn"),
    journal: $("journal"),
    journalGrid: $("journalGrid"),
    journalClose: $("journalClose"),
    journalStats: $("journalStats"),
    zenBeads: $("zenBeads"),
    tensionWrap: $("tensionWrap"),
    reelNeedle: $("reelNeedle"),
    helpBtn: $("helpBtn"),
    help: $("help"),
    helpClose: $("helpClose"),
    aimFan: $("aimFan"),
    aimVeil: $("aimVeil"),
    castHint: $("castHint"),
    dock: $("dock"),
  };

  const save = loadSave();
  let sweetStart = 0.42;
  const SWEET_W = 0.12;

  // 拖抛瞄准
  let aiming = false;
  let aim = null; // Fishing.aimFromPointer 结果
  let fanKey = "";
  let tagTimer = 0;
  let press = null; // 按下手势：{x, y, t0, fired}——按时长/位移/方向分类
  let fanHoldUntil = 0; // 逃鱼/收线后扇面缓一拍再回来

  try {
    const rawSweet = localStorage.getItem("fishpond_sweet");
    if (rawSweet != null && Number.isFinite(Number(rawSweet))) sweetStart = Number(rawSweet);
    else sweetStart = 0.12 + Math.random() * 0.72;
  } catch (e) {
    sweetStart = 0.12 + Math.random() * 0.72;
  }
  sweetStart = Math.max(0.05, Math.min(0.83, sweetStart));

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          zen: typeof p.zen === "number" ? p.zen : 50,
          bait: p.bait || "worm",
          records: p.records || {},
          totalCaught: p.totalCaught || 0,
          totalReleased: p.totalReleased || 0,
          bestWeight: p.bestWeight || 0,
          hintDone: !!p.hintDone,
        };
      }
    } catch (e) { /* 坏档则重开 */ }
    return { zen: 50, bait: "worm", records: {}, totalCaught: 0, totalReleased: 0, bestWeight: 0, hintDone: false };
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      localStorage.setItem("fishpond_sweet", String(sweetStart));
    } catch (e) { /* 隐身模式忽略 */ }
  }

  function inSweet(p) {
    return p >= sweetStart && p <= sweetStart + SWEET_W;
  }

  // 甜区只在一次收获后才换位置，肌肉记忆不白练
  function rerollSweet() {
    sweetStart = 0.1 + Math.random() * 0.74;
    persist();
  }

  /* ---------- zen beads ---------- */
  function paintZen(v) {
    save.zen = v;
    persist();
    const filled = Math.round((v / 100) * 5);
    let html = "";
    for (let i = 0; i < 5; i++) {
      const on = i < filled;
      const full = v >= 95 && i === 4;
      html += `<span class="zen-bead${on ? " on" : ""}${full ? " full" : ""}"></span>`;
    }
    els.zenBeads.innerHTML = html;
  }

  // 放流后一颗静心珠从按钮飞回顶栏
  function flyBead(fromEl) {
    const a = fromEl.getBoundingClientRect();
    const b = els.zenBeads.getBoundingClientRect();
    const bead = document.createElement("span");
    bead.className = "fly-bead";
    bead.style.left = (a.left + a.width / 2) + "px";
    bead.style.top = (a.top + a.height / 2) + "px";
    document.body.appendChild(bead);
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    bead.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: .1 },
    ], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => bead.remove();
  }

  /* ---------- bait ---------- */
  function baitSvgOf(id) {
    const b = Fishing.getBaits().find((x) => x.id === id);
    return b ? b.svg : "";
  }

  function showBaitTag(b) {
    const liked = Fishing.getSpecies().filter((sp) => sp.baits.includes(b.id));
    const fish = liked.map((sp) => {
      const c = Fishing.getRarityMeta(sp.rarity).color;
      return `<svg viewBox="0 0 20 10" aria-label="${sp.name}"><path d="M19 5 C15 1 9 1 5 4 L1 1 L2.5 5 L1 9 L5 6 C9 9 15 9 19 5 Z" fill="${c}"/></svg>`;
    }).join("");
    els.baitTag.innerHTML = `<b>${b.name}</b><i>${b.desc}</i><span class="tag-fish">${fish}</span>`;
    els.baitTag.classList.add("show");
    clearTimeout(tagTimer);
    tagTimer = setTimeout(() => els.baitTag.classList.remove("show"), 2400);
  }

  function paintBait(idOrObj, silent) {
    const id = typeof idOrObj === "string" ? idOrObj : idOrObj.id;
    save.bait = id;
    persist();
    const svg = baitSvgOf(id);
    if (window.Tackle) Tackle.setBait(svg);
    for (const el of els.baitBar.querySelectorAll(".bait-chip")) {
      const on = el.dataset.id === id;
      el.classList.toggle("on", on);
      if (on && !silent) {
        el.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
          { duration: 280, easing: "ease-out" }
        );
      }
    }
    if (!silent) {
      const b = Fishing.getBaits().find((x) => x.id === id);
      if (b) showBaitTag(b);
    }
  }

  function buildBaitBar() {
    els.baitBar.innerHTML = "";
    for (const b of Fishing.getBaits()) {
      const btn = document.createElement("button");
      btn.className = "bait-chip";
      btn.dataset.id = b.id;
      btn.title = b.name;
      btn.setAttribute("aria-label", b.name);
      btn.innerHTML = `<span class="bait-ico">${b.svg}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Fishing.setBait(b.id);
      });
      els.baitBar.appendChild(btn);
    }
    paintBait(save.bait, true);
  }

  /* ---------- 扇面拖抛 ---------- */
  function paintAim(force) {
    const st = Fishing.st.state;
    const showAim = aim && (aiming || st === Fishing.S.IDLE);
    if (!showAim || !aim) {
      if (els.aimFan.childNodes.length) els.aimFan.innerHTML = "";
      fanKey = "";
      return;
    }
    const sweet = inSweet(aim.pow);
    // 全屏任选落点：待机只有幽灵圈，按住才有预览漂；亮带=绕竿尖的距离环
    const mode = aiming ? "aim" : "idle";
    const key = [mode, aim.x.toFixed(1), aim.y.toFixed(1), sweet ? 1 : 0].join("|");
    if (!force && key === fanKey) return;
    fanKey = key;

    const { rx, ry, maxD } = aim;
    const s0 = sweetStart, s1 = sweetStart + SWEET_W;
    const r0 = s0 * maxD, r1 = s1 * maxD;
    const rMid = (r0 + r1) / 2;
    // 距离甜区：绕竿尖一圈的亮带（方向不限）
    const band = (fill, edge) => `
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${rMid.toFixed(1)}" fill="none"
        stroke="rgba(159,208,220,${fill})" stroke-width="${(r1 - r0).toFixed(1)}"/>
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${r0.toFixed(1)}" fill="none"
        stroke="rgba(255,255,255,${edge})" stroke-width="1"/>
      <circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="${r1.toFixed(1)}" fill="none"
        stroke="rgba(255,255,255,${edge})" stroke-width="1"/>`;
    const [xt, yt] = [aim.x, aim.y];
    const ghost = `
      <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="14" fill="none"
        stroke="rgba(44,74,88,.55)" stroke-width="1.4" stroke-dasharray="5 5"/>
      <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="2.8" fill="rgba(44,74,88,.55)"/>`;
    const preview = `
      <g class="pv-bob${sweet ? " sweet" : ""}" transform="translate(${xt.toFixed(1)} ${yt.toFixed(1)})${sweet ? " translate(0 2)" : ""}">
        <ellipse cx="0" cy="10" rx="9" ry="2.6" fill="rgba(255,255,255,.28)"/>
        <rect x="-2.6" y="-13" width="5.2" height="6" rx="2.6" fill="#e88a9a"/>
        <rect x="-4.6" y="-7.6" width="9.2" height="12" rx="4" fill="#fbfdfe" stroke="rgba(120,160,180,.55)" stroke-width="1"/>
        <rect x="-0.9" y="4.4" width="1.8" height="7" rx="0.9" fill="#a88868"/>
      </g>`;

    if (mode === "idle") {
      // 漂还浮在水面（脱钩后）就不画幽灵圈，真漂即是位置
      els.aimFan.innerHTML = band(0.12, 0.22) + (Tackle.floating ? "" : ghost);
      return;
    }
    els.aimFan.innerHTML = band(0.28, 0.45) + preview;
  }

  function startAim(x, y) {
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    aiming = true;
    aim = Fishing.aimFromPointer(x, y);
    els.aimVeil.classList.add("show");
    paintAim(true);
  }

  function moveAim(x, y) {
    if (!aiming) return;
    const next = Fishing.aimFromPointer(x, y);
    aim = next;
    paintAim();
  }

  let holdRingAnim = null;
  function holdRingShow(x, y) {
    if (!els.holdRing) {
      els.holdRing = document.createElement("div");
      els.holdRing.id = "holdRing";
      document.body.appendChild(els.holdRing);
    }
    els.holdRing.style.left = x + "px";
    els.holdRing.style.top = y + "px";
    els.holdRing.classList.add("show");
    holdRingAnim = els.holdRing.animate([
      { transform: "scale(1.2)", opacity: .95 },
      { transform: "scale(.42)", opacity: .5 },
    ], { duration: 450, easing: "ease-in" });
    holdRingAnim.onfinish = () => {
      holdRingAnim = null;
      els.holdRing.classList.remove("show");
      if (press && !press.fired && Fishing.st.state === Fishing.S.WAITING) {
        press.fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        Fishing.retract();
      } else if (press && !press.fired && Tackle.floating && Fishing.st.state === Fishing.S.IDLE) {
        // 脱钩后漂留在水面：长按同样收线
        press.fired = true;
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        Tackle.startReelIn();
      }
    };
  }
  function holdRingCancel() {
    if (holdRingAnim) { holdRingAnim.cancel(); holdRingAnim = null; }
    if (els.holdRing) els.holdRing.classList.remove("show");
  }

  function clearFan() {
    els.aimFan.innerHTML = "";
    fanKey = "";
    els.aimVeil.classList.remove("show");
  }

  function endAim(x, y) {
    if (!aiming) return;
    aiming = false;
    clearFan();
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    // 极短按则以落点为瞄准
    const target = aim || Fishing.aimFromPointer(x, y);
    castTo(target.x, target.y);
  }

  function cancelAim() {
    if (!aiming) { return; }
    aiming = false;
    clearFan();
  }

  function castTo(x, y) {
    if (window.Tackle && Tackle.reeling) return false; // 漂还没收回，先不抛
    const ok = Fishing.castPoint(x, y);
    if (ok) {
      clearFan();
      if (window.Life) Life.disperse();
      if (!save.hintDone) { save.hintDone = true; persist(); } // 首竿成，引导圈退役
      if (window.Tackle) {
        // 分镜落点必须用钳制后的真实落点；漂在水面时从原位直接甩往新钓点
        const lx = Fishing.st.lineX, ly = Fishing.st.lineY;
        const fromPt = Tackle.floating ? Tackle.floatPos() : { x: Fishing.st.rodX, y: Fishing.st.rodY };
        Tackle.startFlight(fromPt, {
          x: lx, y: ly, dist: Math.hypot(lx - fromPt.x, ly - fromPt.y),
        });
        Tackle.setBait(baitSvgOf(save.bait));
      }
    }
    return ok;
  }

  /* ---------- journal ---------- */
  // 鱼鉴与渔获卡共用同一套品种插画
  function miniFishSvg(sp, w) {
    const inner = fishArtInner(sp, "jf" + sp.id);
    return `<svg viewBox="0 0 240 120" width="${w}" height="${Math.round(w * 120 / 240)}" aria-hidden="true"><defs>${inner.defs}</defs>${inner.body}</svg>`;
  }

  function buildJournal() {
    const list = Fishing.getSpecies();
    const groups = {};
    for (const sp of list) (groups[sp.rarity] = groups[sp.rarity] || []).push(sp);
    const order = ["common", "mid", "rare", "epic", "legend"];
    let html = "";
    for (const r of order) {
      const g = groups[r];
      if (!g) continue;
      const meta = Fishing.getRarityMeta(r);
      html += `<div class="j-group"><div class="j-group-head" style="color:${meta.color}">${meta.label}</div><div class="j-grid">`;
      for (const sp of g) {
        const rec = save.records[sp.id];
        html += rec && rec.count > 0
          ? `<button class="j-cell got"><div class="j-fish">${miniFishSvg(sp, 76)}</div><div class="j-name">${sp.name}</div><div class="j-sub">${rec.count} 尾 · ${rec.best} kg</div></button>`
          : `<button class="j-cell"><div class="j-dot" style="background:${meta.color}"></div><div class="j-name">？？？</div><div class="j-sub">${meta.label}</div></button>`;
      }
      html += `</div></div>`;
    }
    els.journalGrid.innerHTML = html;
    // 统计：识得 / 收进 / 放流 / 最大纪录
    let best = null;
    for (const id in save.records) {
      const rec = save.records[id];
      if (rec.count > 0 && rec.best > 0 && (!best || rec.best > best.best)) {
        best = { name: rec.name, best: rec.best };
      }
    }
    els.journalStats.textContent =
      `识得 ${Object.keys(save.records).length}/${list.length} · 收进 ${save.totalCaught} · 放流 ${save.totalReleased}` +
      (best ? ` · 最大 ${best.name} ${best.best} kg` : "");
  }

  function openJournal() {
    buildJournal();
    els.journal.classList.add("open");
  }
  function closeJournal() {
    els.journal.classList.remove("open");
  }

  /* ---------- catch card ---------- */
  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (v >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((v >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (v & 255) + amt));
    return `rgb(${r},${g},${b})`;
  }
  function cardRng(id) {
    let h = 2166136261;
    for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  function spark(x, y, s, o) {
    return `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="#fff" opacity="${o}"/>`;
  }

  // 卡片鱼插画：品种 × 形体模板 × 花纹（确定性随机，同种同貌）
  const CARD_ART = {
    crucian:  { tpl: "normal", h: 0.9, scales: true },
    loach:    { tpl: "normal", h: 0.56, tail: "short", whiskers: true, dots: true },
    bream:    { tpl: "normal", h: 1.16, stripes: true },
    carp:     { tpl: "normal", h: 1.04, whiskers: true, patches: "soft", scales: true },
    goldfish: { tpl: "normal", h: 1.0, tail: "double" },
    koi:      { tpl: "normal", h: 1.06, patches: "koi" },
    puffer:   { tpl: "round", spikes: true, dots: true },
    moon:     { tpl: "eel", glow: true },
    lotus:    { tpl: "sprite" },
  };

  function fishArtInner(sp, uid) {
    const art = CARD_ART[sp.id] || { tpl: "normal", h: 1 };
    const c1 = sp.colors[0], c2 = sp.colors[1];
    const rnd = cardRng(sp.id);
    let defs = "";
    let body = "";

    defs += `<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(c1, -36)}"/>
      <stop offset=".45" stop-color="${c1}"/>
      <stop offset=".8" stop-color="${shade(c1, 30)}"/>
      <stop offset="1" stop-color="${shade(c1, 52)}"/>
    </linearGradient>`;
    defs += `<filter id="${uid}soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>`;

    const eye = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#1c2a33"/><circle cx="${x}" cy="${y}" r="${(r * 0.6).toFixed(1)}" fill="${shade(c2, 36)}"/><circle cx="${(x - r * 0.28).toFixed(1)}" cy="${(y - r * 0.32).toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="#fff" opacity=".92"/>`;
    const whiskers = (x, y) => `<path d="M${x} ${y} C${x + 9} ${y - 4} ${x + 15} ${y - 5} ${x + 20} ${y - 3} M${x} ${y + 4} C${x + 9} ${y + 7} ${x + 15} ${y + 8} ${x + 20} ${y + 6}" stroke="${shade(c2, -20)}" stroke-width="1.6" fill="none" opacity=".85"/>`;
    const finTint = (d) => `<path d="${d}" fill="${c2}" opacity=".4"/>`;

    if (art.tpl === "normal") {
      const h = art.h || 1;
      const BODY = "M224 62 C214 46 190 32 154 29 C118 27 84 36 62 50 C56 54 51 58 50 61 C54 65 62 71 74 77 C100 88 138 93 168 89 C198 85 216 75 224 62 Z";
      const TAIL = {
        flow: "M62 48 C44 38 30 22 26 8 C40 26 56 36 68 40 C56 50 54 74 68 82 C56 86 40 96 26 114 C30 96 44 82 62 72 Z",
        short: "M62 48 C48 40 36 30 30 18 C42 30 56 38 66 42 C58 50 58 70 66 76 C56 80 44 90 30 104 C36 88 48 76 62 70 Z",
      };
      const tailD = art.tail === "short" ? TAIL.short : TAIL.flow;
      let deco = "";
      let patches = "";
      if (art.patches === "koi") {
        for (let i = 0; i < 4; i++) {
          const px = 92 + rnd() * 100, py = 38 + rnd() * 38;
          const prx = 13 + rnd() * 13, pry = 9 + rnd() * 9;
          patches += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${prx.toFixed(1)}" ry="${pry.toFixed(1)}" fill="${i % 2 ? "#e8542e" : "#ef7a3c"}" opacity=".95"/>`;
        }
      } else if (art.patches === "soft") {
        for (let i = 0; i < 3; i++) {
          const px = 96 + rnd() * 92, py = 42 + rnd() * 30;
          patches += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(14 + rnd() * 12).toFixed(1)}" ry="${(8 + rnd() * 7).toFixed(1)}" fill="${shade(c2, -18)}" opacity=".2"/>`;
        }
      }
      if (art.dots) {
        for (let i = 0; i < 9; i++) {
          const px = 74 + rnd() * 128, py = 52 + rnd() * 16;
          patches += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(2 + rnd() * 1.6).toFixed(1)}" fill="${shade(c1, -55)}" opacity=".5"/>`;
        }
      }
      let scales = "";
      if (art.scales) {
        scales = `<path d="M122 34 C114 50 114 68 124 84 M152 30 C144 50 144 70 154 88 M180 34 C172 50 172 68 182 82" stroke="${shade(c1, -44)}" stroke-width="2" fill="none" opacity=".12"/>`;
      }
      let stripes = "";
      if (art.stripes) {
        stripes = `<g clip-path="url(#${uid}clip)"><path d="M108 30 C102 52 102 74 110 88 M138 28 C132 52 132 76 140 90 M166 30 C160 52 160 74 168 88 M192 38 C186 52 186 68 194 82" stroke="${shade(c2, -14)}" stroke-width="3.4" fill="none" opacity=".16"/></g>`;
      }
      const tailG = art.tail === "double"
        ? `<g class="cf-tail" style="transform-origin:60px 62px"><path d="M62 48 C44 38 30 22 26 8 C40 26 56 36 68 40 C56 50 54 74 68 82 C56 86 40 96 26 114 C30 96 44 82 62 72 Z" fill="${c2}" opacity=".38" transform="rotate(-13 60 62)"/><path d="M62 48 C44 38 30 22 26 8 C40 26 56 36 68 40 C56 50 54 74 68 82 C56 86 40 96 26 114 C30 96 44 82 62 72 Z" fill="${c2}" opacity=".38" transform="rotate(11 60 62)"/></g>`
        : `<g class="cf-tail" style="transform-origin:60px 62px"><path d="${tailD}" fill="${c2}" opacity=".55"/></g>`;
      body = `
        <g transform="translate(0 62) scale(1 ${h}) translate(0 -62)">
          ${tailG}
          ${finTint("M116 30 C126 16 150 12 164 18 C150 21 130 27 120 34 Z")}
          ${finTint("M98 86 C92 96 84 102 76 102 C82 94 88 88 94 84 Z")}
          <path d="${BODY}" fill="url(#${uid}g)"/>
          <g clip-path="url(#${uid}clip)">
            <ellipse cx="146" cy="34" rx="60" ry="13" fill="#12303c" opacity=".1"/>
            <ellipse cx="150" cy="84" rx="52" ry="9" fill="#fff" opacity=".16"/>
            <g filter="url(#${uid}soft)">${patches}</g>
            ${stripes}
            ${scales}
          </g>
          <path d="M190 42 C180 50 178 66 186 78" stroke="${shade(c1, -46)}" stroke-width="2" fill="none" opacity=".35"/>
          ${finTint("M178 78 C170 92 156 100 144 99 C154 91 166 83 174 77 Z")}
          ${eye(202, 52, 5.5)}
          <path d="M223 66 C219 68 214 68 210 67" stroke="${shade(c1, -60)}" stroke-width="1.4" fill="none" opacity=".55" stroke-linecap="round"/>
          ${art.whiskers ? whiskers(222, 61) : ""}
        </g>`;
      defs += `<clipPath id="${uid}clip"><path d="${BODY}"/></clipPath>`;
    } else if (art.tpl === "round") {
      let spikes = "";
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2 + 0.26;
        const x1 = 155 + Math.cos(t) * 54, y1 = 60 + Math.sin(t) * 38;
        const x2 = 155 + Math.cos(t) * 65, y2 = 60 + Math.sin(t) * 47;
        if (y2 < 18 || y2 > 104) continue;
        spikes += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${shade(c1, -55)}" stroke-width="2.2" stroke-linecap="round" opacity=".65"/>`;
      }
      let dots = "";
      for (let i = 0; i < 8; i++) {
        const px = 116 + rnd() * 76, py = 34 + rnd() * 26;
        dots += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(3 + rnd() * 2.4).toFixed(1)}" fill="${shade(c1, -52)}" opacity=".42"/>`;
      }
      body = `
        ${spikes}
        <path d="M212 60 C212 36 190 22 158 22 C124 22 98 38 98 60 C98 82 124 98 158 98 C190 98 212 84 212 60 Z" fill="url(#${uid}g)"/>
        <g clip-path="url(#${uid}clip)">${dots}<ellipse cx="155" cy="82" rx="40" ry="13" fill="#fff" opacity=".28"/></g>
        <path d="M102 52 C90 48 80 42 76 34 C84 42 92 48 100 52 C96 56 96 64 100 68 C92 72 84 78 76 86 C80 78 90 72 102 68 Z" fill="${c2}" opacity=".5"/>
        ${eye(192, 48, 6.4)}
        <path d="M206 64 C202 66 198 66 194 65" stroke="${shade(c1, -60)}" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>`;
      defs += `<clipPath id="${uid}clip"><ellipse cx="155" cy="60" rx="56" ry="38"/></clipPath>`;
    } else if (art.tpl === "eel") {
      defs += `<filter id="${uid}glow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#9fd0e8" flood-opacity=".6"/></filter>`;
      body = `
        <g filter="url(#${uid}glow)">
          <path d="M230 62 C214 50 194 62 170 56 C146 50 130 66 104 60 C80 55 60 66 44 60 C40 58 36 58 34 61 C44 68 62 74 86 76 C116 80 148 76 176 70 C202 65 220 72 230 62 Z" fill="url(#${uid}g)" opacity=".82"/>
          <path d="M212 50 C192 44 172 52 148 48 C124 44 102 52 80 50" stroke="${shade(c1, 40)}" stroke-width="2.4" fill="none" opacity=".5"/>
          <path d="M36 61 C26 56 18 58 12 62 C20 65 28 66 36 66 Z" fill="${c2}" opacity=".6"/>
          ${eye(216, 58, 3.6)}
        </g>`;
    } else if (art.tpl === "sprite") {
      defs += `<radialGradient id="${uid}aura" cx=".5" cy=".45" r=".55">
        <stop offset="0" stop-color="${c1}" stop-opacity=".85"/>
        <stop offset="1" stop-color="${c1}" stop-opacity="0"/>
      </radialGradient>`;
      body = `
        <circle cx="120" cy="60" r="46" fill="url(#${uid}aura)" opacity=".6"/>
        ${spark(74, 42, 7, .85)}${spark(168, 50, 5, .8)}${spark(94, 96, 5, .7)}${spark(152, 92, 6, .75)}
        <g class="cf-tail" style="transform-origin:106px 74px"><path d="M104 66 C90 72 82 84 84 98 C96 90 108 84 118 80 Z" fill="${shade(c1, -22)}" opacity=".85"/></g>
        <path d="M120 30 C140 44 144 68 120 90 C96 68 100 44 120 30 Z" fill="url(#${uid}g)" stroke="${shade(c1, -28)}" stroke-width="1.5"/>
        <path d="M120 40 C131 50 133 66 120 80" stroke="#fff" stroke-width="1.6" opacity=".65" fill="none"/>
        <circle cx="120" cy="52" r="3.2" fill="#fff" opacity=".95"/>`;
    }

    return { defs, body };
  }

  function paintCardFish(sp) {
    const a = fishArtInner(sp, "cf" + sp.id);
    els.cardFish.setAttribute("viewBox", "0 0 240 120");
    els.cardFish.innerHTML = `
      <defs>${a.defs}</defs>
      <ellipse cx="126" cy="104" rx="84" ry="7" fill="#123" opacity=".07"/>
      <g class="cf-all">${a.body}</g>`;
  }

  function showCard(fish) {
    const sp = fish.sp;
    const rmeta = Fishing.getRarityMeta(sp.rarity);
    els.cardRarity.textContent = rmeta.label;
    els.cardRarity.style.setProperty("--seal", rmeta.color);
    const rec = save.records[sp.id];
    if (!rec || rec.count === 0) {
      els.cardBadge.textContent = "初见";
      els.cardBadge.hidden = false;
    } else if (fish.weight > save.bestWeight) {
      els.cardBadge.textContent = "新记";
      els.cardBadge.hidden = false;
    } else {
      els.cardBadge.hidden = true;
    }
    els.cardName.textContent = sp.name;
    els.cardMeta.textContent = `${fish.weight} kg · ${fish.size} cm · ${Fishing.st.bait.name}`;
    els.cardPoem.textContent = sp.poem;
    paintCardFish(sp);
    els.card.classList.remove("leave");
    els.card.classList.add("show");
  }

  function hideCard() {
    els.card.classList.add("leave");
    setTimeout(() => els.card.classList.remove("show", "leave"), 280);
  }

  function recordKeep(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    save.records[id].count += 1;
    save.records[id].best = Math.max(save.records[id].best, fish.weight);
    save.totalCaught += 1;
    save.bestWeight = Math.max(save.bestWeight, fish.weight);
    persist();
  }

  function recordSeen(fish) {
    const id = fish.sp.id;
    if (!save.records[id]) save.records[id] = { count: 0, best: 0, name: fish.sp.name };
    save.totalReleased += 1;
    persist();
  }

  function sinkButton(el) {
    el.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(2px)" }, { transform: "translateY(0)" }],
      { duration: 220, easing: "ease-out" }
    );
  }

  /* ---------- panels：状态只用器物与按钮表达，不飘字 ---------- */
  function paintPanels(st) {
    els.tensionWrap.classList.toggle("show", st.state === Fishing.S.FIGHTING);
    els.dock.classList.toggle("card-mode", st.state === Fishing.S.CAUGHT);
    if (st.state !== Fishing.S.IDLE) {
      // 离开待机就收掉扇面与暗角，不留残影
      aiming = false;
      clearFan();
    }
  }

  /* ---------- fishing events ---------- */
  Fishing.onEvent = (type, data) => {
    switch (type) {
      case "bait":
        paintBait(data.bait, data.silent);
        break;
      case "zen":
        paintZen(data.zen);
        break;
      case "waiting":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "nibble":
      case "nibbleTick":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "bite":
        if (window.Tackle) {
          Tackle.setPhase("bite");
          Tackle.splashRing(Fishing.st.lineX, Fishing.st.lineY);
          Tackle.bitePulse(Fishing.st.lineX, Fishing.st.lineY);
        }
        if (window.Life) Life.lungeBait();
        break;
      case "fight":
        if (window.Tackle) {
          Tackle.setPhase("fight", Fishing.st.tension);
          Tackle.startHookset();
          Tackle.setBobberVisible(false);
          Tackle.splashRing(Fishing.st.lineX, Fishing.st.lineY, true);
        }
        if (window.Water) Water.addDrop(Fishing.st.lineX, Fishing.st.lineY, 24, 1.1);
        if (window.Life) Life.hookActive();
        break;
      case "blank":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "escaped":
        hideCard();
        fanHoldUntil = performance.now() + 800;
        {
          const fk = window.Life ? Life.currentKoi() : null;
          if (data.from === "fight" && fk) {
            // 鱼松口窜走，漂在它脱钩的位置弹回水面
            Fishing.st.lineX = fk.x; Fishing.st.lineY = fk.y;
            if (window.Tackle) {
              Tackle.setFloatPos(fk.x, fk.y);
              Tackle.setBobberVisible(true);
            }
            Fishing.st.biteRebound = 0.7;
            Fishing.st.biteReboundAmp = 3;
          }
        }
        if (window.Water && data.from === "fight") {
          // 断线的"崩"：大水花标在断点
          Water.addDrop(Fishing.st.lineX, Fishing.st.lineY, 30, 1.2);
        }
        if (window.Life) Life.fleeBait();
        if (window.Tackle && (data.from === "fight" || data.from === "bite")) {
          // 脱钩后漂浮在原地（真实）：不自动收线，玩家长按收线或直接换钓点
          Tackle.setPhase("wait");
        }
        if (window.Tackle && data.from === "nibble") {
          // 提前扬竿是玩家自己提的竿：竿已出水，收线合理
          setTimeout(() => Tackle.startReelIn(), 80);
        }
        break;
      case "retract":
        fanHoldUntil = performance.now() + 800;
        if (window.Life) Life.disperse();
        if (window.Tackle) Tackle.startReelIn();
        break;
      case "caught":
        if (window.Tackle) {
          Tackle.show(Fishing.st.lineX, Fishing.st.lineY);
          Tackle.setPhase("wait");
        }
        if (window.Life) Life.leapCatch();
        setTimeout(() => showCard(data.fish), 650);
        break;
      case "kept":
        sinkButton(els.btnKeep);
        if (window.Life) Life.removeCurrent();
        setTimeout(() => {
          if (window.Tackle) Tackle.startReelIn();
          hideCard();
          rerollSweet();
        }, 140);
        break;
      case "released":
        sinkButton(els.btnRelease);
        flyBead(els.btnRelease);
        if (window.Life) Life.releaseCurrent();
        setTimeout(() => {
          if (window.Tackle) Tackle.startReelIn();
          hideCard();
          rerollSweet();
        }, 140);
        break;
      default:
        break;
    }
    paintPanels(Fishing.st);
  };

  /* ---------- input ---------- */
  function isUiTarget(e) {
    return e.target.closest(".hud, .panel, .card, .bait-chip");
  }

  function onPointerDown(e) {
    if (isUiTarget(e)) return;
    const st = Fishing.st;
    const onBobber = !!(e.target.closest && e.target.closest("#bobber"));
    if (st.state === Fishing.S.BITE) {
      // 起竿：没顶后任意按下即提竿（起竿爆发动画在 fight 事件里）
      Fishing.hook();
      return;
    }
    if (st.state === Fishing.S.NIBBLE) {
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      if (onBobber) { press.fired = true; Fishing.hook(); } // 点漂=提前扬竿
      else if (window.Water) Water.addDrop(e.clientX, e.clientY, 5, 0.1);
      return;
    }
    if (st.state === Fishing.S.WAITING) {
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      holdRingShow(e.clientX, e.clientY); // 长按 450ms 收线
      return;
    }
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true);
      return;
    }
    if (st.state === Fishing.S.IDLE) {
      if (window.Tackle && Tackle.reeling) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 6, 0.14);
        return;
      }
      press = { x: e.clientX, y: e.clientY, t0: performance.now(), fired: false };
      if (window.Tackle && Tackle.floating) holdRingShow(e.clientX, e.clientY); // 漂在水面：长按收线
    }
  }

  function onPointerMove(e) {
    if (aiming) {
      moveAim(e.clientX, e.clientY);
      return;
    }
    if (!press || press.fired) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    const dt = performance.now() - press.t0;
    const st = Fishing.st;
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true); // 起竿后按住不放，直接进入收线节奏
      return;
    }
    if (st.state === Fishing.S.NIBBLE && dy < -40 && dt < 350) {
      press.fired = true;
      holdRingCancel();
      Fishing.hook(); // 上滑=提前扬竿
      return;
    }
    if (st.state === Fishing.S.WAITING && dy < -40 && dt < 350) {
      press.fired = true;
      holdRingCancel();
      Tackle.startTwitch(); // 空扬竿：竿轻点水
      if (window.Water) Water.addDrop(press.x, press.y, 8, 0.25);
      return;
    }
    if (st.state === Fishing.S.IDLE && Math.hypot(dx, dy) > 24) {
      holdRingCancel();
      startAim(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    Fishing.setReeling(false);
    if (aiming) {
      press = null;
      endAim(e.clientX, e.clientY);
      return;
    }
    if (press) {
      const fired = press.fired;
      press = null;
      holdRingCancel();
      if (fired) return;
      const st = Fishing.st;
      if (st.state === Fishing.S.WAITING) {
        Tackle.startTwitch(); // 轻点=空扬竿
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 8, 0.25);
      } else if (st.state === Fishing.S.NIBBLE) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 5, 0.1);
      } else if (st.state === Fishing.S.IDLE) {
        if (window.Water) Water.addDrop(e.clientX, e.clientY, 7, 0.18);
      }
    }
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", (e) => {
    Fishing.setReeling(false);
    press = null;
    holdRingCancel();
    if (aiming) cancelAim();
  });

  els.tensionWrap.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });

  els.btnKeep.addEventListener("click", (e) => {
    e.stopPropagation();
    if (Fishing.st.pendingFish) recordKeep(Fishing.st.pendingFish);
    Fishing.keepCatch();
  });
  els.btnRelease.addEventListener("click", (e) => {
    e.stopPropagation();
    if (Fishing.st.pendingFish) recordSeen(Fishing.st.pendingFish);
    Fishing.releaseCatch();
  });

  els.journalBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openJournal();
  });
  els.journalClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeJournal();
  });
  els.journal.addEventListener("click", (e) => {
    if (e.target === els.journal) closeJournal();
  });

  els.helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    els.help.classList.add("open");
  });
  els.helpClose.addEventListener("click", (e) => {
    e.stopPropagation();
    els.help.classList.remove("open");
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      const st = Fishing.st;
      if (st.state === Fishing.S.IDLE) castTo(innerWidth * 0.45, innerHeight * 0.4);
      else if (st.state === Fishing.S.WAITING) Fishing.retract();
      else if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
      else if (st.state === Fishing.S.FIGHTING) Fishing.setReeling(true);
    }
    if (e.code === "Escape") {
      closeJournal();
      els.help.classList.remove("open");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") Fishing.setReeling(false);
  });

  /* ---------- boot / frame ---------- */
  function boot() {
    buildBaitBar();
    Fishing.setBait(save.bait || "worm", true);
    Fishing.st.zen = save.zen;
    paintZen(Fishing.st.zen);
    // 默认瞄准池心
    aim = Fishing.aimFromPointer(innerWidth * 0.45, innerHeight * 0.4);
    paintAim(true);
    paintPanels(Fishing.st);
  }

  function frame(now, dt) {
    const st = Fishing.st;
    if (window.Tackle) {
      if (st.state === Fishing.S.FIGHTING) {
        Tackle.setPhase("fight", st.tension);
        els.reelNeedle.setAttribute("transform", `rotate(${(-120 + st.tension * 240).toFixed(1)} 48 48)`);
        els.tensionWrap.classList.toggle("danger", st.tension > 0.78 || st.tension < 0.25);
      }
      Tackle.setDip(st.bobberDip || 0);
      if (!Tackle.visible && !Tackle.animating && !Tackle.reeling && st.state === Fishing.S.IDLE) {
        Tackle.setPhase("idle");
      }
      // 鱼跃出/遛鱼时，钓线跟着鱼走；黑漂时漂跟着鱼走
      const jk = window.Life ? Life.currentKoi() : null;
      if (jk && jk.job && (jk.job.kind === "leap" || jk.job.kind === "hooked" || jk.job.kind === "hookjump")) {
        Tackle.lineFollow(jk.x, jk.y);
      } else Tackle.clearLineFollow();
      if (st.state === Fishing.S.BITE) Tackle.dragFloatTo(st.lineX, st.lineY);
      else Tackle.clearDragFloat();
      Tackle.update(dt);
    }
    if (st.state === Fishing.S.IDLE && !aiming && performance.now() > fanHoldUntil) {
      if (!aim) aim = Fishing.aimFromPointer(innerWidth * 0.45, innerHeight * 0.4);
      paintAim();
      // 首钓引导：池心呼吸圈，首竿成即退役
      if (!save.hintDone) {
        els.castHint.style.left = aim.x.toFixed(1) + "px";
        els.castHint.style.top = aim.y.toFixed(1) + "px";
        els.castHint.classList.add("show");
      } else {
        els.castHint.classList.remove("show");
      }
    } else {
      els.castHint.classList.remove("show");
    }
  }

  window.App = { boot, frame };
  boot();
})();
