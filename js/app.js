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
    actionBtn: $("actionBtn"),
    helpBtn: $("helpBtn"),
    help: $("help"),
    helpClose: $("helpClose"),
    aimFan: $("aimFan"),
    aimVeil: $("aimVeil"),
    retractBtn: $("retractBtn"),
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
  let press = null; // IDLE 按下待判定：拖够距离才瞄准
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
  function polar(rx, ry, ang, r) {
    return [rx + Math.cos(ang) * r, ry + Math.sin(ang) * r];
  }

  function paintFan(force) {
    const st = Fishing.st.state;
    const showAim = aim && (aiming || st === Fishing.S.IDLE);
    if (!showAim || !aim) {
      if (els.aimFan.childNodes.length) els.aimFan.innerHTML = "";
      fanKey = "";
      return;
    }
    const sweet = inSweet(aim.pow);
    // 待机只留"落点小漂 + 弱光带"；按住水面才展开整面
    const mode = aiming ? "aim" : "idle";
    const key = [mode, aim.x.toFixed(1), aim.y.toFixed(1), aim.ang.toFixed(3), aim.dist.toFixed(1), sweet ? 1 : 0].join("|");
    if (!force && key === fanKey) return;
    fanKey = key;

    const { rx, ry, ang, dist, pow, minD, maxD } = aim;
    const spread = 14 * Math.PI / 180;
    const a1 = ang - spread, a2 = ang + spread;
    const rOut = maxD;
    const [x1, y1] = polar(rx, ry, a1, rOut);
    const [x2, y2] = polar(rx, ry, a2, rOut);
    const [xt, yt] = polar(rx, ry, ang, dist);
    // 甜区弧带
    const s0 = sweetStart, s1 = sweetStart + SWEET_W;
    const d0 = minD + s0 * (maxD - minD);
    const d1 = minD + s1 * (maxD - minD);
    const [sx1, sy1] = polar(rx, ry, a1, d0);
    const [sx2, sy2] = polar(rx, ry, a2, d0);
    const [sx3, sy3] = polar(rx, ry, a2, d1);
    const [sx4, sy4] = polar(rx, ry, a1, d1);
    const band = (fill, stroke, w) =>
      `<path d="M${sx1} ${sy1} L${sx2} ${sy2} A${d0} ${d0} 0 0 1 ${sx3} ${sy3} L${sx4} ${sy4} A${d1} ${d1} 0 0 0 ${sx1} ${sy1} Z"
        fill="rgba(159,208,220,${fill})" stroke="rgba(255,255,255,${stroke})" stroke-width="${w}" class="band-core"/>`;
    const preview = `
      <g class="pv-bob${sweet ? " sweet" : ""}" transform="translate(${xt.toFixed(1)} ${yt.toFixed(1)})${sweet ? " translate(0 2)" : ""}">
        <ellipse cx="0" cy="10" rx="9" ry="2.6" fill="rgba(255,255,255,.28)"/>
        <rect x="-2.6" y="-13" width="5.2" height="6" rx="2.6" fill="#e88a9a"/>
        <rect x="-4.6" y="-7.6" width="9.2" height="12" rx="4" fill="#fbfdfe" stroke="rgba(120,160,180,.55)" stroke-width="1"/>
        <rect x="-0.9" y="4.4" width="1.8" height="7" rx="0.9" fill="#a88868"/>
      </g>`;

    if (mode === "idle") {
      // 待机：虚线幽灵圈示意落点，不冒充真漂
      els.aimFan.innerHTML = `
        ${band(0.2, 0.45, 1.2)}
        <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="14" fill="none"
          stroke="rgba(44,74,88,.55)" stroke-width="1.4" stroke-dasharray="5 5"/>
        <circle cx="${xt.toFixed(1)}" cy="${yt.toFixed(1)}" r="2.8" fill="rgba(44,74,88,.55)"/>
      `;
      return;
    }

    // 距离刻度（瞄准态）
    let ticks = "";
    for (let i = 1; i <= 6; i++) {
      const rt = minD + (maxD - minD) * (i / 7);
      const [t1x, t1y] = polar(rx, ry, ang, rt);
      const [t2x, t2y] = polar(rx, ry, ang, rt + 9);
      ticks += `<line class="fan-tick" x1="${t1x.toFixed(1)}" y1="${t1y.toFixed(1)}" x2="${t2x.toFixed(1)}" y2="${t2y.toFixed(1)}"/>`;
    }
    els.aimFan.innerHTML = `
      <path d="M${rx} ${ry} L${x1} ${y1} A${rOut} ${rOut} 0 0 1 ${x2} ${y2} Z"
        fill="rgba(72,120,140,0.16)" stroke="rgba(44,74,88,0.38)" stroke-width="1.2"/>
      ${band(sweet ? 0.52 : 0.26, sweet ? 0.95 : 0.6, 1.6)}
      ${ticks}
      ${preview}
    `;
  }

  function startAim(x, y) {
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    aiming = true;
    aim = Fishing.aimFromPointer(x, y);
    els.aimVeil.classList.add("show");
    paintFan(true);
  }

  function moveAim(x, y) {
    if (!aiming) return;
    const next = Fishing.aimFromPointer(x, y);
    aim = next;
    paintFan();
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
        // 分镜落点必须用钳制后的真实落点，否则漂与鱼影/涟漪分家
        const lx = Fishing.st.lineX, ly = Fishing.st.lineY;
        Tackle.startFlight({ x: Fishing.st.rodX, y: Fishing.st.rodY }, {
          x: lx, y: ly, dist: Math.hypot(lx - Fishing.st.rodX, ly - Fishing.st.rodY),
        });
        Tackle.setBait(baitSvgOf(save.bait));
      }
    }
    return ok;
  }

  /* ---------- journal ---------- */
  function buildJournal() {
    els.journalGrid.innerHTML = "";
    const list = Fishing.getSpecies();
    for (const sp of list) {
      const rec = save.records[sp.id];
      const rmeta = Fishing.getRarityMeta(sp.rarity);
      const cell = document.createElement("button");
      cell.className = "j-cell" + (rec ? " got" : "");
      cell.innerHTML = `
        <div class="j-dot" style="background:${rmeta.color}"></div>
        <div class="j-name">${rec ? sp.name : "？？？"}</div>
        <div class="j-sub">${rec ? rec.count + " 尾 · " + rec.best + " kg" : rmeta.label}</div>
      `;
      els.journalGrid.appendChild(cell);
    }
    els.journalStats.textContent =
      `识得 ${Object.keys(save.records).length}/${list.length} · 收进 ${save.totalCaught} · 放流 ${save.totalReleased}`;
  }

  function openJournal() {
    buildJournal();
    els.journal.classList.add("open");
  }
  function closeJournal() {
    els.journal.classList.remove("open");
  }

  /* ---------- catch card ---------- */
  function paintCardFish(sp) {
    const c1 = sp.colors[0], c2 = sp.colors[1];
    const spots = (sp.id.length % 3) + 1;
    let blobs = "";
    for (let i = 0; i < spots; i++) {
      const cx = 40 + i * 22 + (sp.id.charCodeAt(i % sp.id.length) % 10);
      const cy = 22 + (i % 2) * 10;
      blobs += `<ellipse cx="${cx}" cy="${cy}" rx="${8 + i * 2}" ry="${5 + i}" fill="${c2}" opacity=".55"/>`;
    }
    els.cardFish.innerHTML = `
      <defs>
        <linearGradient id="cfG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <clipPath id="cfC">
          <path d="M18 28 C28 10 55 6 78 14 C92 20 100 24 108 28 C100 32 92 36 78 42 C55 50 28 46 18 28 Z"/>
        </clipPath>
      </defs>
      <path d="M18 28 C28 10 55 6 78 14 C92 20 100 24 108 28 C100 32 92 36 78 42 C55 50 28 46 18 28 Z"
        fill="url(#cfG)" stroke="${c2}" stroke-width="1"/>
      <path d="M18 28 L4 14 L10 28 L4 42 Z" fill="${c2}" opacity=".75"/>
      <g clip-path="url(#cfC)">${blobs}</g>
      <circle cx="88" cy="24" r="2.2" fill="#2c4a58" opacity=".7"/>
    `;
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
    const idle = st.state === Fishing.S.IDLE;
    els.retractBtn.hidden = st.state !== Fishing.S.WAITING;
    els.actionBtn.hidden = st.state !== Fishing.S.BITE;
    els.actionBtn.textContent = "扬竿";
    els.actionBtn.className = "action-btn" + (st.state === Fishing.S.BITE ? " urgent" : "");
    els.tensionWrap.classList.toggle("show", st.state === Fishing.S.FIGHTING);
    els.dock.classList.toggle("card-mode", st.state === Fishing.S.CAUGHT);
    if (!idle) {
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
        }
        if (window.Life) Life.lungeBait();
        break;
      case "fight":
        if (window.Tackle) Tackle.setPhase("fight", Fishing.st.tension);
        if (window.Life) Life.hookActive();
        break;
      case "blank":
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "escaped":
        hideCard();
        fanHoldUntil = performance.now() + 800;
        if (window.Water && data.from === "fight") {
          // 断线的"崩"：大水花标在断点
          Water.addDrop(Fishing.st.lineX, Fishing.st.lineY, 30, 1.2);
        }
        if (window.Life) Life.fleeBait();
        if (window.Tackle) {
          // 咬钩脱钩先看它吐钩回弹，遛鱼失败喘半拍，再收线
          const delay = data.from === "fight" ? 500 : data.from === "bite" ? 350 : 80;
          setTimeout(() => Tackle.startReelIn(), delay);
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
        setTimeout(() => showCard(data.fish), 420);
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
    return e.target.closest(".hud, .panel, .card, .bait-chip, .action-btn, .retract-btn");
  }

  function onPointerDown(e) {
    if (isUiTarget(e)) return;
    const st = Fishing.st;
    const onBobber = !!(e.target.closest && e.target.closest("#bobber"));
    if (st.state === Fishing.S.BITE) {
      Fishing.hook();
      return;
    }
    if (st.state === Fishing.S.NIBBLE) {
      // 只有碰到浮漂才算扬竿，别处点水不惊鱼
      if (onBobber) Fishing.hook();
      else if (window.Water) Water.addDrop(e.clientX, e.clientY, 5, 0.1);
      return;
    }
    if (st.state === Fishing.S.WAITING) {
      // 等待期点水只起涟漪；收线只认角落的收线钮
      if (window.Water) Water.addDrop(e.clientX, e.clientY, 6, 0.14);
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
      // 按下先不进入瞄准：拖动超过阈值才算"要抛"，短点只起涟漪
      press = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerMove(e) {
    if (aiming) {
      moveAim(e.clientX, e.clientY);
      return;
    }
    if (press && Fishing.st.state === Fishing.S.IDLE &&
        Math.hypot(e.clientX - press.x, e.clientY - press.y) > 24) {
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
      // 短点击：只应一句涟漪，不抛竿
      if (window.Water) Water.addDrop(e.clientX, e.clientY, 7, 0.18);
      press = null;
    }
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", (e) => {
    Fishing.setReeling(false);
    press = null;
    if (aiming) cancelAim();
  });

  els.tensionWrap.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });

  els.retractBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    Fishing.retract();
  });

  els.actionBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const st = Fishing.st;
    if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
    else if (st.state === Fishing.S.FIGHTING) Fishing.setReeling(true);
  });
  els.actionBtn.addEventListener("pointerup", (e) => {
    e.stopPropagation();
    Fishing.setReeling(false);
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
    paintFan(true);
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
      Tackle.update(dt);
    }
    if (st.state === Fishing.S.IDLE && !aiming && performance.now() > fanHoldUntil) {
      if (!aim) aim = Fishing.aimFromPointer(innerWidth * 0.45, innerHeight * 0.4);
      paintFan();
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
