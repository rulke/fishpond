/* UI 组装：能量滑轮抛竿、饵形切换、HUD、图鉴。导出 App */
(function () {
  "use strict";

  const SAVE_KEY = "fishpond_save_v1";
  const $ = (id) => document.getElementById(id);

  const els = {
    zenFill: $("zenFill"),
    baitBar: $("baitBar"),
    baitPreview: $("baitPreview"),
    hookBait: $("hookBait"),
    hint: $("hint"),
    toast: $("toast"),
    card: $("catchCard"),
    cardArt: $("cardArt"),
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
    tensionWrap: $("tensionWrap"),
    tensionFill: $("tensionFill"),
    tensionHint: $("tensionHint"),
    tensionPad: $("tensionPad"),
    lineLayer: $("lineLayer"),
    bobber: $("bobber"),
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
  };

  const save = loadSave();
  let castDir = 0.5;
  let castPow = 0.55;
  try {
    const rawDir = localStorage.getItem("fishpond_dir");
    const rawPow = localStorage.getItem("fishpond_pow");
    // Number(null)===0，缺键时必须回落默认
    if (rawDir != null && Number.isFinite(Number(rawDir))) castDir = Number(rawDir);
    if (rawPow != null && Number.isFinite(Number(rawPow))) castPow = Number(rawPow);
  } catch (e) { /* ignore */ }
  castDir = Math.max(0, Math.min(1, castDir));
  castPow = Math.max(0.18, Math.min(1, castPow));

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
    } catch (e) { /* 隐身模式忽略 */ }
  }

  /* ---------- toast ---------- */
  let toastTimer = 0;
  function toast(text, ms = 2200) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
  }

  /* ---------- zen ---------- */
  function paintZen(v) {
    save.zen = v;
    els.zenFill.style.width = v + "%";
    persist();
  }

  /* ---------- bait 形象（预览 + 钩上） ---------- */
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
    els.hookBait.innerHTML = svg;
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

  /* ---------- energy rollers（方向 / 能量滑轮） ---------- */
  function setRollerVisual() {
    els.dirThumb.style.left = (castDir * 100).toFixed(1) + "%";
    const dFill = els.dirRoller.querySelector(".roller-fill");
    if (dFill) dFill.style.width = (castDir * 100).toFixed(1) + "%";
    els.powThumb.style.left = (castPow * 100).toFixed(1) + "%";
    els.powFill.style.width = (castPow * 100).toFixed(1) + "%";
  }

  function applyAim(showGhost) {
    Fishing.setCastAim(castDir, castPow);
    setRollerVisual();
    persist();
    if (showGhost && Fishing.st.state === Fishing.S.IDLE) {
      const aim = Fishing.aimToXY(castDir, castPow);
      els.castGhost.style.opacity = "1";
      els.castGhost.style.transform = `translate(${aim.x}px, ${aim.y}px)`;
    } else {
      els.castGhost.style.opacity = "0";
    }
  }

  function rollerValueFromEvent(roller, e) {
    const r = roller.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
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
      if (rec) cell.addEventListener("click", () => toast(`${sp.name}｜${sp.poem}`, 3200));
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
  function showCard(fish) {
    const sp = fish.sp;
    const rmeta = Fishing.getRarityMeta(sp.rarity);
    els.cardRarity.textContent = rmeta.label;
    els.cardRarity.style.color = rmeta.color;
    els.cardName.textContent = sp.name;
    els.cardMeta.textContent = `${fish.weight} kg · ${fish.size} cm · ${Fishing.st.bait.name}`;
    els.cardPoem.textContent = sp.poem;
    els.cardArt.style.setProperty("--c1", sp.colors[0]);
    els.cardArt.style.setProperty("--c2", sp.colors[1]);
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

  /* ---------- line & bobber ---------- */
  let bobberVisible = false;
  function showBobber(x, y) {
    els.bobber.style.transform = `translate(${x}px, ${y}px)`;
    els.bobber.classList.add("show");
    bobberVisible = true;
  }
  function hideBobber() {
    els.bobber.classList.remove("show");
    bobberVisible = false;
    els.castGhost.style.opacity = "0";
  }

  function drawLine() {
    const st = Fishing.st;
    if (!bobberVisible && st.state !== Fishing.S.FIGHTING) {
      els.lineLayer.innerHTML = "";
      return;
    }
    const rx = st.rodX, ry = st.rodY;
    const bx = st.lineX, by = st.lineY + (st.bobberDip || 0) * 8;
    const gx = rx + 28, gy = ry + 40;
    const cx = (rx + bx) / 2;
    const cy = Math.min(ry, by) - 40 - Math.hypot(rx - bx, ry - by) * 0.08;
    els.lineLayer.innerHTML = `
      <svg width="100%" height="100%" style="position:absolute;inset:0">
        <path d="M${gx} ${gy} Q ${rx + 8} ${ry + 8} ${rx} ${ry}" stroke="#6b5344" stroke-width="3.2" stroke-linecap="round" fill="none"/>
        <path d="M${rx} ${ry} Q ${cx} ${cy} ${bx} ${by}" stroke="rgba(255,255,255,.72)" stroke-width="1.1" fill="none"/>
      </svg>`;
  }

  function paintBobber(st) {
    if (!bobberVisible) return;
    const dip = st.bobberDip || 0;
    els.bobber.style.transform = `translate(${st.lineX}px, ${st.lineY + dip * 10}px) scale(${1 - dip * 0.12})`;
  }

  /* ---------- tension ---------- */
  function paintTension(st) {
    const on = st.state === Fishing.S.FIGHTING;
    els.tensionWrap.classList.toggle("show", on);
    if (!on) return;
    els.tensionFill.style.width = (st.tension * 100).toFixed(1) + "%";
    const t = st.tension;
    let hint = "按住收线，松手歇一下";
    let cls = "mid";
    if (t > 0.8) { hint = "线太紧了，松一下"; cls = "high"; }
    else if (t < 0.2) { hint = "线松了，轻轻收一点"; cls = "low"; }
    else if (t > 0.35 && t < 0.75) { hint = "手感刚刚好"; cls = "good"; }
    els.tensionHint.textContent = hint;
    els.tensionHint.className = cls;
  }

  /* ---------- panels visibility ---------- */
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
       st.state === Fishing.S.NIBBLE ? "wait" : "soft");
  }

  /* ---------- hint ---------- */
  const HINTS = {
    idle: "拨方向与能量滑轮，按抛竿",
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
        if (!data.silent) toast(`换上${data.bait.name}`, 1500);
        break;
      case "zen":
        paintZen(data.zen);
        break;
      case "aim":
        break;
      case "cast":
        showBobber(data.x, data.y);
        setHint("waiting");
        break;
      case "waiting":
        setHint("waiting");
        break;
      case "nibble":
      case "nibbleTick":
        setHint("nibble");
        if (type === "nibble") toast("水下有动静", 1200);
        break;
      case "bite":
        setHint("bite");
        toast("咬钩", 1000);
        break;
      case "fight":
        setHint("fight");
        break;
      case "blank":
        toast("空空如也");
        break;
      case "escaped":
        hideBobber();
        hideCard();
        setHint("idle");
        toast(data.text || "游走了", 2000);
        break;
      case "retract":
        hideBobber();
        setHint("idle");
        break;
      case "caught":
        showBobber(Fishing.st.lineX, Fishing.st.lineY);
        showCard(data.fish);
        setHint("caught");
        break;
      case "kept":
        hideBobber();
        hideCard();
        setHint("idle");
        toast("收进篓篓", 1500);
        break;
      case "released":
        hideBobber();
        hideCard();
        setHint("idle");
        toast("放归池中 · 静心 +5", 1600);
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
    // IDLE：点水面仅起涟漪，抛竿走滑轮
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

  /* ---------- boot ---------- */
  function boot() {
    buildBaitBar();
    Fishing.setBait(save.bait || "worm", true);
    Fishing.st.zen = save.zen;
    paintZen(Fishing.st.zen);
    Fishing.setCastAim(castDir, castPow);
    setRollerVisual();
    applyAim(true);
    setHint("idle");
    paintPanels(Fishing.st);
  }

  function frame() {
    const st = Fishing.st;
    drawLine();
    paintBobber(st);
    paintTension(st);
  }

  window.App = { boot, frame, toast };
  boot();
})();
