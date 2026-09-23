/* UI 组装：器物抛竿坞、莲苞静心、渔获卡、图鉴。导出 App */
(function () {
  "use strict";

  const SAVE_KEY = "fishpond_save_v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    baitBar: $("baitBar"),
    baitPreview: $("baitPreview"),
    hint: $("hint"),
    toast: $("toast"),
    card: $("catchCard"),
    cardArt: $("cardArt"),
    cardFish: $("cardFish"),
    cardName: $("cardName"),
    cardMeta: $("cardMeta"),
    cardPoem: $("cardPoem"),
    cardRarity: $("cardRarity"),
    btnKeep: $("btnKeep"),
    btnRelease: $("btnRelease"),
    journalBtn: $("journalBtn"),
    journal: $("journal"),
    journalGrid: $("journalGrid"),
    journalClose: $("journalClose"),
    journalStats: $("journalStats"),
    zenLotus: $("zenLotus"),
    tensionWrap: $("tensionWrap"),
    tensionFill: $("tensionFill"),
    tensionHint: $("tensionHint"),
    tensionPad: $("tensionPad"),
    actionBtn: $("actionBtn"),
    helpBtn: $("helpBtn"),
    help: $("help"),
    helpClose: $("helpClose"),
    castPanel: $("castPanel"),
    castBtn: $("castBtn"),
    castGhost: $("castGhost"),
    dirRoller: $("dirRoller"),
    dirThumb: $("dirThumb"),
    powRoller: $("powRoller"),
    powThumb: $("powThumb"),
    powFill: $("powFill"),
    sweetZone: $("sweetZone"),
  };

  const save = loadSave();
  let castDir = 0.5;
  let castPow = 0.55;
  let sweetStart = 0.42;
  const SWEET_W = 0.12;

  try {
    const rawDir = localStorage.getItem("fishpond_dir");
    const rawPow = localStorage.getItem("fishpond_pow");
    const rawSweet = localStorage.getItem("fishpond_sweet");
    if (rawDir != null && Number.isFinite(Number(rawDir))) castDir = Number(rawDir);
    if (rawPow != null && Number.isFinite(Number(rawPow))) castPow = Number(rawPow);
    if (rawSweet != null && Number.isFinite(Number(rawSweet))) sweetStart = Number(rawSweet);
    else sweetStart = 0.12 + Math.random() * 0.72;
  } catch (e) {
    sweetStart = 0.12 + Math.random() * 0.72;
  }
  castDir = clamp01(castDir);
  castPow = Math.max(0.18, Math.min(1, castPow));
  sweetStart = Math.max(0.05, Math.min(0.83, sweetStart));

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

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
        };
      }
    } catch (e) { /* 坏档则重开 */ }
    return { zen: 50, bait: "worm", records: {}, totalCaught: 0, totalReleased: 0, bestWeight: 0 };
  }

  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      localStorage.setItem("fishpond_dir", String(castDir));
      localStorage.setItem("fishpond_pow", String(castPow));
      localStorage.setItem("fishpond_sweet", String(sweetStart));
    } catch (e) { /* 隐身模式忽略 */ }
  }

  function inSweet(p) {
    return p >= sweetStart && p <= sweetStart + SWEET_W;
  }

  function rerollSweet() {
    sweetStart = 0.1 + Math.random() * 0.74;
    persist();
    paintRollers();
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(text, ms = 1600) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
  }

  /* ---------- zen lotus（5 瓣） ---------- */
  function paintZen(v) {
    save.zen = v;
    persist();
    const filled = Math.round((v / 100) * 5);
    let petals = "";
    // 五瓣莲苞：外瓣张开、内瓣收拢
    for (let i = 0; i < 5; i++) {
      const on = i < filled;
      const rot = (i - 2) * 36;
      const r = on ? 1.05 : 0.92;
      petals += `<path d="M24 20 C18 14 18 6 24 2 C30 6 30 14 24 20 Z"
        transform="rotate(${rot} 24 20) scale(${r}) translate(${(1 - r) * 24 / r} ${(1 - r) * 20 / r})"
        fill="${on ? "#e8a8b8" : "rgba(42,69,84,.10)"}"
        stroke="${on ? "#d48aa0" : "rgba(42,69,84,.12)"}" stroke-width=".7"/>`;
    }
    const core = v >= 95
      ? `<circle cx="24" cy="19" r="3" fill="#c9a45a"/>`
      : `<circle cx="24" cy="19" r="2.4" fill="${filled > 2 ? "#e8d4a0" : "rgba(42,69,84,.16)"}"/>`;
    els.zenLotus.innerHTML = petals + core;
  }

  /* ---------- bait ---------- */
  function baitSvgOf(id) {
    const b = Fishing.getBaits().find((x) => x.id === id);
    return b ? b.svg : "";
  }

  function paintBait(idOrObj) {
    const id = typeof idOrObj === "string" ? idOrObj : idOrObj.id;
    save.bait = id;
    persist();
    const svg = baitSvgOf(id);
    els.baitPreview.innerHTML = svg;
    if (window.Tackle) Tackle.setBait(svg);
    for (const el of els.baitBar.querySelectorAll(".bait-chip")) {
      el.classList.toggle("on", el.dataset.id === id);
    }
  }

  function buildBaitBar() {
    els.baitBar.innerHTML = "";
    for (const b of Fishing.getBaits()) {
      const btn = document.createElement("button");
      btn.className = "bait-chip";
      btn.dataset.id = b.id;
      btn.title = b.desc;
      btn.innerHTML = `<span class="bait-ico">${b.svg}</span><span>${b.name}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        Fishing.setBait(b.id);
      });
      els.baitBar.appendChild(btn);
    }
    paintBait(save.bait);
  }

  /* ---------- rollers ---------- */
  function paintRollers() {
    els.dirThumb.style.left = (castDir * 100).toFixed(1) + "%";
    const dFill = els.dirRoller.querySelector(".ruler-fill");
    if (dFill) dFill.style.width = (castDir * 100).toFixed(1) + "%";
    els.powThumb.style.left = (castPow * 100).toFixed(1) + "%";
    els.powFill.style.width = (castPow * 100).toFixed(1) + "%";
    els.sweetZone.style.left = (sweetStart * 100).toFixed(1) + "%";
    els.sweetZone.style.width = (SWEET_W * 100).toFixed(1) + "%";
  }

  function applyAim(showGhost) {
    Fishing.setCastAim(castDir, castPow);
    paintRollers();
    persist();
    const sweet = inSweet(castPow);
    if (showGhost && Fishing.st.state === Fishing.S.IDLE) {
      const aim = Fishing.aimToXY(castDir, castPow);
      els.castGhost.style.opacity = "1";
      els.castGhost.style.transform = `translate(${aim.x}px, ${aim.y}px)`;
      els.castGhost.classList.toggle("sweet", sweet);
      els.sweetZone.classList.toggle("hit", sweet);
    } else {
      els.castGhost.style.opacity = "0";
      els.castGhost.classList.remove("sweet");
      els.sweetZone.classList.remove("hit");
    }
  }

  function rollerValueFromEvent(roller, e) {
    const r = roller.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / Math.max(1, r.width));
  }

  function bindRoller(roller, onVal) {
    let dragging = false;
    const start = (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      roller.classList.add("dragging");
      onVal(rollerValueFromEvent(roller, e));
    };
    const move = (e) => {
      if (!dragging) return;
      e.stopPropagation();
      onVal(rollerValueFromEvent(roller, e));
    };
    const end = (e) => {
      if (!dragging) return;
      e.stopPropagation();
      dragging = false;
      roller.classList.remove("dragging");
    };
    roller.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  bindRoller(els.dirRoller, (v) => {
    castDir = v;
    applyAim(true);
  });
  bindRoller(els.powRoller, (v) => {
    castPow = Math.max(0.18, v);
    applyAim(true);
  });

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
      if (rec) cell.addEventListener("click", () => toast(`${sp.name}｜${sp.poem}`, 2800));
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

  /* ---------- catch card：剪影 + 斑纹 ---------- */
  function paintCardFish(sp) {
    const c1 = sp.colors[0], c2 = sp.colors[1];
    const spots = (sp.id.length % 3) + 1;
    let blobs = "";
    for (let i = 0; i < spots; i++) {
      const cx = 48 + i * 16 + (sp.id.charCodeAt(i % sp.id.length) % 8);
      const cy = 24 + (i % 2) * 8;
      blobs += `<ellipse cx="${cx}" cy="${cy}" rx="${7 + i * 1.5}" ry="${5 + i * 0.8}" fill="${c2}" opacity=".5"/>`;
    }
    // 圆润鱼身 + 叉尾 + 双鳍
    els.cardFish.innerHTML = `
      <defs>
        <linearGradient id="cfG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
        <clipPath id="cfC">
          <ellipse cx="62" cy="28" rx="34" ry="16"/>
        </clipPath>
      </defs>
      <path d="M28 28 L10 14 C16 22 16 34 10 42 Z" fill="${c2}" opacity=".8"/>
      <path d="M62 12 L54 4 L70 11 Z" fill="${c2}" opacity=".65"/>
      <path d="M62 44 L54 52 L70 45 Z" fill="${c2}" opacity=".65"/>
      <ellipse cx="62" cy="28" rx="34" ry="16" fill="url(#cfG)" stroke="${c2}" stroke-width="1"/>
      <g clip-path="url(#cfC)">${blobs}</g>
      <circle cx="84" cy="24" r="2.4" fill="#2a4554" opacity=".75"/>
      <circle cx="84.7" cy="23.3" r="0.8" fill="#fff" opacity=".7"/>
      <path d="M28 28 Q45 26 58 28" stroke="${c2}" stroke-width=".8" fill="none" opacity=".35"/>
    `;
  }

  function showCard(fish) {
    const sp = fish.sp;
    const rmeta = Fishing.getRarityMeta(sp.rarity);
    els.cardRarity.textContent = rmeta.label;
    els.cardRarity.style.color = rmeta.color;
    els.cardName.textContent = sp.name;
    els.cardMeta.textContent = `${fish.weight} kg · ${fish.size} cm · ${Fishing.st.bait.name}`;
    els.cardPoem.textContent = sp.poem;
    paintCardFish(sp);
    els.card.classList.add("show");
  }
  function hideCard() {
    els.card.classList.remove("show");
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

  /* ---------- panels ---------- */
  function paintPanels(st) {
    const idle = st.state === Fishing.S.IDLE;
    els.castPanel.classList.toggle("show", idle);
    els.actionBtn.hidden = idle || st.state === Fishing.S.CAUGHT;

    const map = {
      [Fishing.S.CASTING]: "……",
      [Fishing.S.WAITING]: "收回",
      [Fishing.S.NIBBLE]: "有试探 · 别提",
      [Fishing.S.BITE]: "扬竿！",
      [Fishing.S.FIGHTING]: "按住收线",
      [Fishing.S.CAUGHT]: "看看渔获",
    };
    els.actionBtn.textContent = map[st.state] || "";
    els.actionBtn.className =
      "action-btn " +
      (st.state === Fishing.S.BITE || st.state === Fishing.S.FIGHTING ? "urgent" :
       st.state === Fishing.S.NIBBLE ? "wait" : "");
  }

  const HINTS = {
    idle: "拨竹尺定方向，卷线轮蓄力，落进亮环更妙",
    waiting: "浮漂静了……",
    nibble: "水下试探，先别提",
    bite: "就是现在",
    fight: "按住收线，过紧就松",
    caught: "一尾入网",
  };
  function setHint(k) {
    els.hint.textContent = HINTS[k] || HINTS.idle;
    els.hint.classList.remove("pulse");
    void els.hint.offsetWidth;
    els.hint.classList.add("pulse");
  }

  /* ---------- fishing events ---------- */
  Fishing.onEvent = (type, data) => {
    switch (type) {
      case "bait":
        paintBait(data.bait);
        if (!data.silent) toast(`换上${data.bait.name}`, 1400);
        break;
      case "zen":
        paintZen(data.zen);
        break;
      case "cast": {
        setHint("waiting");
        if (window.Tackle) {
          const tip = { x: Fishing.st.rodX, y: Fishing.st.rodY };
          Tackle.startFlight(tip, { x: data.x, y: data.y, dist: Math.hypot(data.x - tip.x, data.y - tip.y) });
          Tackle.setBait(baitSvgOf(save.bait));
        }
        if (data.grade === "sweet") toast("顺风一抛", 1500);
        else if (data.grade === "poor") toast("散了窝", 1200);
        else toast("漂已落水", 1200);
        break;
      }
      case "waiting":
        setHint("waiting");
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "nibble":
      case "nibbleTick":
        setHint("nibble");
        if (window.Tackle) Tackle.setPhase("wait");
        break;
      case "bite":
        setHint("bite");
        toast("咬钩", 1000);
        if (window.Tackle) Tackle.setPhase("cast");
        break;
      case "fight":
        setHint("fight");
        if (window.Tackle) Tackle.setPhase("fight", Fishing.st.tension);
        break;
      case "blank":
        toast("空空如也", 1100);
        break;
      case "escaped":
        if (window.Tackle) Tackle.hide();
        hideCard();
        setHint("idle");
        toast(data.text || "游走了", 1800);
        rerollSweet();
        break;
      case "retract":
        if (window.Tackle) Tackle.hide();
        setHint("idle");
        rerollSweet();
        break;
      case "caught":
        if (window.Tackle) {
          Tackle.show(Fishing.st.lineX, Fishing.st.lineY);
          Tackle.setPhase("wait");
        }
        showCard(data.fish);
        setHint("caught");
        break;
      case "kept":
        if (window.Tackle) Tackle.hide();
        hideCard();
        setHint("idle");
        toast("收进篓篓", 1400);
        rerollSweet();
        break;
      case "released":
        if (window.Tackle) Tackle.hide();
        hideCard();
        setHint("idle");
        toast("放归池中 · 静心 +5", 1500);
        rerollSweet();
        break;
      default:
        break;
    }
    paintPanels(Fishing.st);
  };

  /* ---------- input ---------- */
  function isUiTarget(e) {
    return e.target.closest(".hud, .panel, .card, .roller");
  }

  function doCast() {
    if (Fishing.st.state !== Fishing.S.IDLE) return;
    Fishing.cast(castDir, castPow);
  }

  function onPointerDown(e) {
    if (isUiTarget(e)) return;
    const st = Fishing.st;
    if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) {
      Fishing.hook();
      return;
    }
    if (st.state === Fishing.S.FIGHTING) {
      Fishing.setReeling(true);
      return;
    }
    if (st.state === Fishing.S.WAITING) {
      Fishing.retract();
      return;
    }
    if (st.state === Fishing.S.IDLE && window.Water) {
      Water.addDrop(e.clientX, e.clientY, 8, 0.12);
    }
  }

  function onPointerUp() {
    Fishing.setReeling(false);
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  let lastMove = null;
  window.addEventListener("pointermove", (e) => {
    if (isUiTarget(e)) return;
    if (lastMove && window.Water && Fishing.st.state === Fishing.S.IDLE) {
      const speed = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y);
      if (speed > 18) {
        Water.addDrop(e.clientX, e.clientY, 7 + speed * 0.05, Math.min(0.1, 0.02 + speed * 0.001));
      }
    }
    lastMove = { x: e.clientX, y: e.clientY };
  }, { passive: true });

  els.tensionPad.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });
  els.tensionWrap.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    Fishing.setReeling(true);
  });

  els.castBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    doCast();
  });

  els.actionBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const st = Fishing.st;
    if (st.state === Fishing.S.BITE || st.state === Fishing.S.NIBBLE) Fishing.hook();
    else if (st.state === Fishing.S.FIGHTING) Fishing.setReeling(true);
    else if (st.state === Fishing.S.WAITING) Fishing.retract();
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
      if (st.state === Fishing.S.IDLE) doCast();
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
    Fishing.setCastAim(castDir, castPow);
    applyAim(true);
    setHint("idle");
    paintPanels(Fishing.st);
  }

  function frame(now, dt) {
    const st = Fishing.st;
    if (window.Tackle) {
      if (st.state === Fishing.S.FIGHTING) Tackle.setPhase("fight", st.tension);
      if (window.Tackle) Tackle.setDip(st.bobberDip || 0);
      // 未抛出时也画空闲竿
      if (!Tackle.visible && st.state === Fishing.S.IDLE) Tackle.setPhase("idle");
      Tackle.update(dt);
    }
  }

  window.App = { boot, frame, toast };
  boot();
})();
