/* 钓鱼状态机：抛竿 / 试探 / 咬钩 / 遛鱼 / 渔获。导出 Fishing */
(function () {
  "use strict";

  // 矢量饵形：切换时钩上与预览都会换形象（不用 emoji，避免乱码）
  const BAITS = [
    {
      id: "worm",
      name: "红虫",
      desc: "寻常小物也爱",
      tier: "common",
      svg: `<svg viewBox="0 0 32 32" class="bait-svg" aria-hidden="true">
        <path d="M9 27c1-5 3-8 7-11 3-2 5-6 6-10" fill="none" stroke="#c94a38" stroke-width="5" stroke-linecap="round"/>
        <path d="M9 27c1-5 3-8 7-11 3-2 5-6 6-10" fill="none" stroke="#e87868" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M8.2 24.5h3.2M11.5 19.5h3.2M15 15.2h3M18 10.5h2.8" stroke="#9e3224" stroke-width="1.4" stroke-linecap="round" opacity=".65"/>
      </svg>`,
    },
    {
      id: "corn",
      name: "玉米",
      desc: "肥鱼偏好",
      tier: "mid",
      svg: `<svg viewBox="0 0 32 32" class="bait-svg" aria-hidden="true">
        <ellipse cx="16" cy="18" rx="7.5" ry="10" fill="#f0d060"/>
        <ellipse cx="16" cy="18" rx="7.5" ry="10" fill="none" stroke="#c4a03c" stroke-width="1.2"/>
        <path d="M11.5 13.5q4.5 2 9 0 M11 18.5q5 2 10 0 M11.5 23q4.5 2 9 0" stroke="#c4a03c" stroke-width="1.1" fill="none" opacity=".75"/>
        <path d="M16 8c1.5-3 4-4 6-2.5-1.5 1.2-3.5 2-6 2.5z" fill="#7d9e78"/>
      </svg>`,
    },
    {
      id: "petal",
      name: "花瓣饵",
      desc: "花运在侧更灵",
      tier: "rare",
      svg: `<svg viewBox="0 0 32 32" class="bait-svg" aria-hidden="true">
        <path d="M16 4c6 5 7 14 0 23C9 18 10 9 16 4z" fill="#f3b8c8"/>
        <path d="M16 4c6 5 7 14 0 23C9 18 10 9 16 4z" fill="none" stroke="#e896a8" stroke-width="1"/>
        <path d="M16 7v15" stroke="#fff" stroke-width="1.2" opacity=".55"/>
        <path d="M9 20c3 2 5 4 7 7M23 20c-3 2-5 4-7 7" stroke="#fff" stroke-width="1" opacity=".35" fill="none"/>
      </svg>`,
    },
  ];

  const SPECIES = [
    { id: "crucian", name: "鲫鱼", rarity: "common", weight: [0.2, 1.2], baits: ["worm", "corn"], poem: "浅滩碎金，一闪即逝。", colors: ["#c9d6c2", "#8fad8a"] },
    { id: "loach", name: "泥鳅", rarity: "common", weight: [0.1, 0.5], baits: ["worm"], poem: "泥里修行，滑不留手。", colors: ["#8b7355", "#5c4a32"] },
    { id: "bream", name: "鳊鱼", rarity: "common", weight: [0.4, 2.0], baits: ["corn", "worm"], poem: "薄如银叶，贴水而行。", colors: ["#d8e2ea", "#9aafc0"] },
    { id: "carp", name: "鲤鱼", rarity: "mid", weight: [1.0, 5.5], baits: ["corn", "petal"], poem: "一摆尾，半池春水皱。", colors: ["#e8a86a", "#c47a3a"] },
    { id: "goldfish", name: "琉金", rarity: "mid", weight: [0.2, 0.9], baits: ["petal", "worm"], poem: "袖珍灯笼，照不见岸。", colors: ["#ff9a52", "#ff7028"] },
    { id: "koi", name: "锦鲤", rarity: "rare", weight: [1.5, 8.0], baits: ["petal", "corn"], poem: "花影落处，有缘者得。", colors: ["#fff2ea", "#ef5a3a"] },
    { id: "puffer", name: "河豚", rarity: "rare", weight: [0.3, 1.5], baits: ["worm", "petal"], poem: "圆滚滚一肚子气，也圆滚滚一肚子甜。", colors: ["#e8d9a8", "#c4a86a"] },
    { id: "moon", name: "月光鳗", rarity: "epic", weight: [0.8, 3.0], baits: ["petal"], poem: "只在心最静时，才肯露一线银光。", colors: ["#d4e8f5", "#7a9bb8"] },
    { id: "lotus", name: "荷心精灵", rarity: "legend", weight: [0.1, 0.3], baits: ["petal"], poem: "不是鱼，是荷叶尖上的一滴露。", colors: ["#ffd6e8", "#fff3c9"] },
  ];

  const RARITY = {
    common: { label: "寻常", weight: 58, color: "#6f9e82" },
    mid: { label: "雅致", weight: 26, color: "#d4a853" },
    rare: { label: "珍奇", weight: 12, color: "#e87a6a" },
    epic: { label: "月华", weight: 3.2, color: "#7a9bb8" },
    legend: { label: "传说", weight: 0.8, color: "#c08bb8" },
  };

  // 咬钩窗口；上浮段就是"窗口将尽"的视觉信号，用运动代替倒计时
  const BITE_WINDOW = 1.6;

  const S = {
    IDLE: "IDLE",
    CASTING: "CASTING",
    WAITING: "WAITING",
    NIBBLE: "NIBBLE",
    BITE: "BITE",
    FIGHTING: "FIGHTING",
    CAUGHT: "CAUGHT",
  };

  // 游玩状态
  const st = {
    state: S.IDLE,
    bait: BAITS[0],
    zen: 50,          // 0-100，越高稀有越有缘
    lineX: 0, lineY: 0,   // 浮漂位置
    rodX: 0, rodY: 0,     // 竿尖
    nibbleLeft: 0,
    nibbleTimer: 0,
    biteTimer: 0,
    waitTimer: 0,
    biteKoi: null,     // 被指派来咬钩的塘内真鱼
    reaskT: 0,
    pendingFish: null,
    tension: 0.35,        // 0-1
    fightProgress: 0,     // 0-1 收服进度
    fightPhase: 0,
    bobberDip: 0,
    lastCastAt: 0,
    castDir: 0.5,         // 0=偏左 1=偏右
    castPow: 0.55,        // 0.2-1 远近
    onEvent: null,        // UI 回调
  };

  function emit(type, data) {
    if (st.onEvent) st.onEvent(type, data || {});
  }

  function setCastAim(dir, pow) {
    st.castDir = Math.max(0, Math.min(1, dir));
    st.castPow = Math.max(0.18, Math.min(1, pow));
    emit("aim", { dir: st.castDir, pow: st.castPow });
    return { dir: st.castDir, pow: st.castPow };
  }

  // 由方向/能量算落点：竿居中偏右，向池心抛（扇面与竿尖同源）
  function aimToXY(dir, pow) {
    const rx = innerWidth > 720 ? innerWidth * 0.5 + 60 : innerWidth * 0.55;
    const ry = innerHeight > 640 ? innerHeight * 0.74 : innerHeight * 0.76;
    const maxD = Math.min(innerWidth, innerHeight) * 0.82;
    const ang = dir != null ? dir * Math.PI * 2 : Math.PI * 1.25;
    const dist = pow * maxD;
    const x = Math.max(30, Math.min(innerWidth - 30, rx + Math.cos(ang) * dist));
    const y = Math.max(30, Math.min(innerHeight - 30, ry + Math.sin(ang) * dist));
    return { x, y, ang, dist, rx, ry };
  }

  function zenAdd(v) {
    st.zen = Math.max(0, Math.min(100, st.zen + v));
    emit("zen", { zen: st.zen });
  }

  // 稀有鱼"愿不愿意来"：花瓣饵 + 花运 + 静心的老配方，喂给 Life 的候选筛选
  function approachBoost() {
    const luck = (window.Life && Life.flowerLuck) ? Life.flowerLuck(st.lineX, st.lineY) : 0;
    const zenBonus = (st.zen - 50) / 50; // -1..1
    return (st.bait.id === "petal" ? 1.5 : 1) * (1 + luck * 1.2) * (1 + Math.max(0, zenBonus) * 0.8);
  }

  // 咬钩的鱼 = 塘里被钩住的那条；体重在该种区间内随机
  function rollFishFor(koi) {
    const sp = (koi && koi.spId) ? (SPECIES.find((s) => s.id === koi.spId) || SPECIES[0]) : SPECIES[0];
    const [w0, w1] = sp.weight;
    const weight = +(w0 + Math.random() * (w1 - w0)).toFixed(2);
    const size = Math.round(12 + (weight / Math.max(w1, 0.1)) * 28 + Math.random() * 6);
    return { sp, weight, size, koi };
  }

  function waitDuration() {
    // 静心高则更快上鱼；附近有鱼也加速
    let base = 6 + Math.random() * 10;
    base *= 1 - (st.zen - 50) * 0.004;
    if (window.Life) {
      const d = Life.nearestKoiDist(st.lineX, st.lineY);
      if (d < 200) base *= 0.7;
    }
    return Math.max(2.5, base);
  }

  // 甜区：能量落在 [sweetStart, sweetStart+0.12] 更准（app 在 cast 后读 grade）
  function gradeCast(pow) {
    const raw = localStorage.getItem("fishpond_sweet");
    const start = raw != null ? Number(raw) : 0.42;
    const s = Number.isFinite(start) ? start : 0.42;
    if (pow >= s && pow <= s + 0.12) return "sweet";
    const mid = s + 0.06;
    return Math.abs(pow - mid) > 0.22 ? "poor" : "ok";
  }

  // 从杆尖到指针：返回合法落点（扇面内）
  function aimFromPointer(px, py) {
    const rx = innerWidth > 720 ? innerWidth * 0.5 + 60 : innerWidth * 0.55;
    const ry = innerHeight > 640 ? innerHeight * 0.74 : innerHeight * 0.76;
    const maxD = Math.min(innerWidth, innerHeight) * 0.82;
    // 全屏任选：落点即指针（留 30px 边距），力度=离竿尖的距离
    const x = Math.max(30, Math.min(innerWidth - 30, px));
    const y = Math.max(30, Math.min(innerHeight - 30, py));
    const dist = Math.hypot(x - rx, y - ry);
    const pow = Math.max(0, Math.min(1, dist / maxD));
    const ang = Math.atan2(y - ry, x - rx);
    return { x, y, ang, dist, pow, rx, ry, minD: 0, maxD };
  }

  function setBait(id, silent) {
    if (st.state !== S.IDLE && st.state !== S.CAUGHT) return false;
    const b = BAITS.find((x) => x.id === id);
    if (!b) return false;
    st.bait = b;
    emit("bait", { bait: b, silent: !!silent });
    return true;
  }

  // 扇面拖抛：按落点抛竿
  function castPoint(px, py) {
    if (st.state !== S.IDLE && st.state !== S.CAUGHT) return false;
    const now = performance.now();
    if (now - st.lastCastAt < 350) return false;
    const aim = aimFromPointer(px, py);
    const grade = gradeCast(aim.pow);
    st.lastCastAt = now;
    st.lineX = aim.x;
    st.lineY = aim.y;
    st.rodX = aim.rx;
    st.rodY = aim.ry;
    st.castDir = Math.max(0, Math.min(1, (((aim.ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)));
    st.castPow = aim.pow;
    st.state = S.CASTING;
    st.bobberDip = 0;
    st.tension = 0.35;
    st.fightProgress = 0;
    st.pendingFish = null;
    st.castGrade = grade;
    zenAdd(grade === "sweet" ? 0 : -1);
    const splash = grade === "sweet" ? 0.55 : grade === "poor" ? 1.0 : 0.75;
    if (window.Water) {
      setTimeout(() => {
        Water.addDrop(aim.x, aim.y, (16 + aim.pow * 14) * splash, (0.6 + aim.pow * 0.5) * splash);
        if (grade === "sweet") Water.addDrop(aim.x + 8, aim.y - 4, 10, 0.2);
      }, 500);
    }
    if (window.Life) Life.startleKoi(aim.x, aim.y);
    emit("cast", { x: aim.x, y: aim.y, pow: aim.pow, grade, rx: aim.rx, ry: aim.ry });
    setTimeout(() => {
      if (st.state !== S.CASTING) return;
      st.state = S.WAITING;
      st.waitTimer = waitDuration();
      st.biteKoi = null;
      st.reaskT = 0.6;
      emit("waiting", {});
      // 等待期计时与抛竿分镜同源，漂落水后才开钓
    }, window.Tackle ? Tackle.castDuration(aim.dist) : 640);
    return true;
  }

  function retract() {
    if (st.state === S.CAUGHT || st.state === S.IDLE) return;
    st.bobberDip = 0;
    st.biteKoi = null;
    if (st.state === S.FIGHTING) {
      // 主动收线失败也温柔
      st.state = S.IDLE;
      emit("escaped", { text: "线松了，它缓缓游开。", from: "fight" });
      return;
    }
    st.state = S.IDLE;
    emit("retract", {});
  }

  // 试探中提前扬竿 → 惊走
  function hook() {
    if (st.state === S.NIBBLE) {
      st.state = S.IDLE;
      st.bobberDip = 0;
      st.biteKoi = null;
      zenAdd(-6);
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 18, 0.5);
      emit("escaped", { text: "扬竿早了，水花一散。", from: "nibble" });
      return;
    }
    if (st.state === S.BITE) {
      st.state = S.FIGHTING;
      st.tension = 0.45;
      st.fightProgress = 0;
      st.fightPhase = 0;
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 22, 0.8);
      emit("fight", { fish: st.pendingFish });
      return;
    }
    if (st.state === S.WAITING) {
      // 空竿，轻轻点一下水
      if (window.Water) Water.addDrop(st.lineX, st.lineY, 14, 0.25);
      emit("blank", {});
    }
  }

  function setReeling(on) {
    st.reeling = !!on;
  }

  function updateFight(dt) {
    if (!st.pendingFish) return;
    const f = st.pendingFish;
    // 鱼的拉力：呼吸正弦 + 冲刺脉冲
    st.fightPhase += dt * (1.2 + f.weight * 0.15);
    const surge = Math.max(0, Math.sin(st.fightPhase * 2.2)) ** 2;
    const pull = 0.12 + surge * 0.35 + f.weight * 0.02;
    if (st.reeling) {
      st.tension += dt * (0.28 + f.weight * 0.03);
      st.fightProgress += dt * 0.22 * (st.tension > 0.25 && st.tension < 0.78 ? 1.25 : 0.35);
    } else {
      st.tension -= dt * 0.32;
      st.fightProgress += dt * 0.08;
    }
    st.tension -= dt * pull * 0.35;
    st.tension = Math.max(0, Math.min(1, st.tension));

    // 张力过高/过低太久会脱钩（阈值很宽，休闲向）
    if (st.tension > 0.92 || st.tension < 0.08) {
      st.slackBad = (st.slackBad || 0) + dt;
      if (st.slackBad > 1.4) {
        st.state = S.IDLE;
        st.slackBad = 0;
        st.bobberDip = 0;
        st.biteKoi = null;
        zenAdd(-4);
        emit("escaped", { text: "手感不对，它借力走了。", from: "fight" });
        return;
      }
    } else {
      st.slackBad = 0;
    }

    if (st.tension > 0.35 && st.tension < 0.8) {
      if (window.Water && Math.random() < dt * 3) Water.addDrop(st.lineX, st.lineY, 10, 0.08);
    }

    if (st.fightProgress >= 1) {
      st.fightProgress = 1;
      st.state = S.CAUGHT;
      zenAdd(8 + (f.sp.rarity === "legend" ? 15 : f.sp.rarity === "epic" ? 10 : 4));
      if (window.Water) {
        Water.addDrop(st.lineX, st.lineY, 36, 1.4);
        Water.addDrop(st.lineX + 20, st.lineY - 10, 18, 0.6);
      }
      emit("caught", { fish: f });
    }
  }

  function releaseCatch() {
    if (st.state !== S.CAUGHT) return;
    st.state = S.IDLE;
    st.biteKoi = null;
    zenAdd(5);
    emit("released", { fish: st.pendingFish });
  }

  function keepCatch() {
    if (st.state !== S.CAUGHT) return;
    st.state = S.IDLE;
    st.biteKoi = null;
    emit("kept", { fish: st.pendingFish });
  }

  function update(now, dt) {
    switch (st.state) {
      case S.WAITING: {
        st.waitTimer -= dt;
        // 请一位对口的真鱼来赴宴；塘里没有就在塘外安排一位
        if (window.Life && !st.biteKoi) {
          if (st.reaskT > 0) st.reaskT -= dt;
          else {
            st.biteKoi = Life.beginApproach(st.bait.id, st.lineX, st.lineY, approachBoost());
            if (!st.biteKoi) { Life.ensureCandidate(st.bait.id); st.reaskT = 3; }
          }
        }
        if (st.waitTimer <= 0) {
          // 到点仍无候选：就近请一位兜底
          if (window.Life && !st.biteKoi) st.biteKoi = Life.assignNearest(st.lineX, st.lineY);
          st.state = S.NIBBLE;
          st.nibbleLeft = 1 + ((Math.random() * 3) | 0);
          st.nibbleTimer = 0.35 + Math.random() * 0.5;
          emit("nibble", { left: st.nibbleLeft });
        }
        break;
      }
      case S.NIBBLE: {
        st.nibbleTimer -= dt;
        if (st.nibbleTimer <= 0) {
          // 一次试探点水
          st.bobberDip = 1;
          if (window.Water) Water.addDrop(st.lineX, st.lineY, 12, 0.35 + Math.random() * 0.2);
          st.nibbleLeft -= 1;
          if (st.nibbleLeft <= 0) {
            st.state = S.BITE;
            st.biteTimer = BITE_WINDOW;
            st.bobberDip = 1.5;
            st.pendingFish = rollFishFor(st.biteKoi);
            if (window.Water) Water.addDrop(st.lineX, st.lineY, 16, 0.7);
            emit("bite", { fish: st.pendingFish });
          } else {
            st.nibbleTimer = 0.55 + Math.random() * 0.7;
            emit("nibbleTick", { left: st.nibbleLeft });
          }
        }
        st.bobberDip = Math.max(0, st.bobberDip - dt * 3);
        break;
      }
      case S.BITE: {
        st.biteTimer -= dt;
        // 三拍：快沉没顶 → 按住 → 上浮
        const gone = BITE_WINDOW - Math.max(0, st.biteTimer);
        if (gone < 0.25) st.bobberDip = 1.5 + (gone / 0.25) * 2.7;
        else if (gone < 1.1) st.bobberDip = 4.2;
        else st.bobberDip = Math.max(0.9, 4.2 - ((gone - 1.1) / 0.5) * 3.3);
        if (st.biteTimer <= 0) {
          st.state = S.IDLE;
          st.bobberDip = 0;
          st.biteKoi = null;
          zenAdd(-3);
          if (window.Water) Water.addDrop(st.lineX, st.lineY, 14, 0.5);
          emit("escaped", { text: "没提竿……它吐钩走了。", from: "bite" });
        }
        break;
      }
      case S.FIGHTING: {
        updateFight(dt);
        break;
      }
      case S.CAUGHT: {
        st.bobberDip = 0;
        break;
      }
      default:
        break;
    }
  }

  function getRarityMeta(r) { return RARITY[r] || RARITY.common; }
  function getSpecies() { return SPECIES; }
  function getBaits() { return BAITS; }

  window.Fishing = {
    S,
    st,
    setBait,
    setCastAim,
    aimToXY,
    aimFromPointer,
    castPoint,
    retract,
    hook,
    setReeling,
    releaseCatch,
    keepCatch,
    update,
    getRarityMeta,
    getSpecies,
    getBaits,
    set onEvent(fn) { st.onEvent = fn; },
    get state() { return st.state; },
  };
})();
