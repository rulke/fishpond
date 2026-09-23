/* WebGL 水面：高度场模拟 + 底图折射。导出 Water */
(function () {
  "use strict";

  const canvas = document.getElementById("gl");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    document.body.innerHTML = "<p style='padding:2em;font-family:serif'>当前浏览器不支持 WebGL，鱼塘暂且搁浅。</p>";
    throw new Error("no webgl");
  }

  const extHF = gl.getExtension("OES_texture_half_float");
  let useHF = false;
  if (extHF) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, extHF.HALF_FLOAT_OES, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    useHF = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(f);
    gl.deleteTexture(t);
  }

  const QUAD_VS = `
attribute vec2 p;
varying vec2 vUv;
void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

  const CODEC = useHF
    ? `#define ENC(h) vec4(h,0.,0.,1.)
float DEC(vec4 c){ return c.r; }`
    : `vec4 ENC(float h){
  float v = clamp(h*0.25+0.5, 0., 1.);
  float hi = floor(v*255.)/255.;
  float lo = fract(v*255.);
  return vec4(hi, lo, 0., 1.);
}
float DEC(vec4 c){
  float v = c.r + c.g/255.;
  return (v-0.5)*4.;
}`;

  const SIM_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec4 uDrops[8];
uniform int uDropCount;
uniform float uDamp;
${CODEC}
void main(){
  float l = DEC(texture2D(uCur, vUv + vec2(-uTexel.x,0.)));
  float r = DEC(texture2D(uCur, vUv + vec2( uTexel.x,0.)));
  float t = DEC(texture2D(uCur, vUv + vec2(0., uTexel.y)));
  float b = DEC(texture2D(uCur, vUv + vec2(0.,-uTexel.y)));
  float prev = DEC(texture2D(uPrev, vUv));
  float h = (l+r+t+b)*0.5 - prev;
  h *= uDamp;
  for (int i = 0; i < 8; i++) {
    if (i >= uDropCount) break;
    vec2 d = vUv - uDrops[i].xy;
    d.x *= uTexel.y/uTexel.x;
    float dist = length(d);
    float k = 1.0 - smoothstep(0., uDrops[i].z, dist);
    h += uDrops[i].w * k * k;
  }
  vec2 edge = min(vUv, 1.-vUv);
  float wall = smoothstep(0., 0.012, min(edge.x, edge.y));
  h *= wall;
  gl_FragColor = ENC(h);
}`;

  const RENDER_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uHeight;
uniform sampler2D uBg;
uniform vec2 uTexel;
uniform vec2 uRes;
uniform vec2 uBgScale;
uniform float uTime;
${CODEC}
float hAt(vec2 uv){ return DEC(texture2D(uHeight, uv)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  float hl = hAt(vUv + vec2(-uTexel.x,0.));
  float hr = hAt(vUv + vec2( uTexel.x,0.));
  float ht = hAt(vUv + vec2(0., uTexel.y));
  float hb = hAt(vUv + vec2(0.,-uTexel.y));
  vec2 grad = vec2(hr-hl, ht-hb);
  vec3 n = normalize(vec3(-grad.x, -grad.y, 0.14));

  vec2 bgUv = (vUv-0.5)*uBgScale + 0.5;
  vec2 ruv = bgUv + n.xy * 0.075;
  vec3 col = texture2D(uBg, ruv).rgb;

  col = (col - 0.5) * 1.08 + 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, 1.22), 0., 1.);

  vec3 tintA = vec3(0.78, 0.90, 0.96);
  vec3 tintB = vec3(0.96, 0.86, 0.93);
  vec3 tint = mix(tintA, tintB, smoothstep(0., 1., vUv.y*0.8 + 0.1*sin(uTime*0.2)));
  col = mix(col, tint, 0.12);

  vec3 L = normalize(vec3(0.35, 0.5, 0.8));
  float spec = pow(max(dot(n, L), 0.), 220.);
  float agit = clamp(length(grad)*18. - 0.08, 0., 1.);
  agit *= agit;
  vec2 cellUv = vUv*uRes/11.;
  vec2 cell = floor(cellUv);
  float rnd = hash(cell);
  vec2 cpos = 0.3 + 0.4*vec2(hash(cell+1.3), hash(cell+7.7));
  float tw = 0.5 + 0.5*sin(uTime*(3.+rnd*7.) + rnd*40.);
  float glint = smoothstep(0.32, 0., length(fract(cellUv) - cpos));
  float sparkle = glint * step(0.8, rnd) * tw * tw * agit;

  float crest = clamp(hAt(vUv)*2.2, -1., 1.);
  float glow = clamp(spec*0.5 + sparkle*0.5 + max(crest, 0.)*0.05, 0., 0.85);
  vec3 glowCol = glow * vec3(1., 0.98, 0.92);
  col = 1.0 - (1.0 - col) * (1.0 - glowCol);
  col -= max(-crest, 0.) * 0.035 * vec3(0.9, 1., 1.);

  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q,q)*0.22;

  gl_FragColor = vec4(col, 1.);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, QUAD_VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const simProg = program(SIM_FS);
  const renProg = program(RENDER_FS);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  function bindQuad(prog) {
    const loc = gl.getAttribLocation(prog, "p");
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  const SIM = Math.min(512, Math.max(256, Math.floor(Math.min(innerWidth, innerHeight) * 0.6)));
  let simW = SIM, simH = SIM;
  function makeSimTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, simW, simH, 0, gl.RGBA, useHF ? extHF.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(useHF ? 0 : 0.5, useHF ? 0 : 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex: t, fbo: f };
  }
  let bufPrev = makeSimTex(), bufCur = makeSimTex(), bufNext = makeSimTex();

  const bgTex = gl.createTexture();
  let bgW = 1, bgH = 1, bgReady = false;
  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([200, 225, 240, 255]));

  const img = new Image();
  img.onload = () => {
    bgW = img.width;
    bgH = img.height;
    let src = img;
    try {
      const work = document.createElement("canvas");
      work.width = bgW;
      work.height = bgH;
      const wx = work.getContext("2d");
      wx.drawImage(img, 0, 0);
      if (window.Life && Life.buildPads) Life.buildPads(work, wx);
      src = work;
    } catch (e) { /* 提取失败则荷叶留在底图里 */ }
    bgReady = true;
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  // 优先用内嵌底图（file:// 下 WebGL 不能吃跨源 img）；否则回落 flash1.png
  function loadBg() {
    if (!window.Life) {
      setTimeout(loadBg, 30);
      return;
    }
    const emb = window.EMBEDDED_BG || "";
    img.src = emb.startsWith("data:") ? emb : "flash1.png";
  }
  loadBg();

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(innerWidth * DPR);
    H = Math.floor(innerHeight * DPR);
    canvas.width = W;
    canvas.height = H;
  }
  addEventListener("resize", resize);
  resize();

  const drops = [];
  const jsRipples = [];

  function addDrop(cx, cy, radiusPx, strength) {
    const x = cx / innerWidth, y = 1 - cy / innerHeight;
    drops.push({ x, y, r: radiusPx / Math.min(innerWidth, innerHeight), s: strength });
    jsRipples.push({ x: cx, y: cy, t0: performance.now() / 1000, amp: strength });
    if (jsRipples.length > 40) jsRipples.shift();
  }

  const WAVE_SPEED = 260;
  function rippleField(px, py, now) {
    let dx = 0, dy = 0, h = 0;
    for (let i = jsRipples.length - 1; i >= 0; i--) {
      const r = jsRipples[i];
      const age = now - r.t0;
      if (age > 4) continue;
      const dist = Math.hypot(px - r.x, py - r.y) + 0.001;
      const front = age * WAVE_SPEED;
      const d = dist - front;
      const env = Math.exp(-(d * d) / (2 * 55 * 55)) * Math.exp(-age * 1.1) * r.amp;
      if (env < 0.003) continue;
      const wave = Math.sin(d * 0.055) * env;
      h += wave;
      const push = wave * 14 / dist;
      dx += (px - r.x) * push;
      dy += (py - r.y) * push;
    }
    return { h, dx, dy };
  }

  const uSim = {
    uCur: gl.getUniformLocation(simProg, "uCur"),
    uPrev: gl.getUniformLocation(simProg, "uPrev"),
    uTexel: gl.getUniformLocation(simProg, "uTexel"),
    uDrops: gl.getUniformLocation(simProg, "uDrops"),
    uDropCount: gl.getUniformLocation(simProg, "uDropCount"),
    uDamp: gl.getUniformLocation(simProg, "uDamp"),
  };
  const uRen = {
    uHeight: gl.getUniformLocation(renProg, "uHeight"),
    uBg: gl.getUniformLocation(renProg, "uBg"),
    uTexel: gl.getUniformLocation(renProg, "uTexel"),
    uRes: gl.getUniformLocation(renProg, "uRes"),
    uBgScale: gl.getUniformLocation(renProg, "uBgScale"),
    uTime: gl.getUniformLocation(renProg, "uTime"),
  };

  const MAX_DROPS = 8;
  const dropArr = new Float32Array(MAX_DROPS * 4);
  function simStep(batch) {
    gl.useProgram(simProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bufNext.fbo);
    gl.viewport(0, 0, simW, simH);
    bindQuad(simProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufCur.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bufPrev.tex);
    gl.uniform1i(uSim.uCur, 0);
    gl.uniform1i(uSim.uPrev, 1);
    gl.uniform2f(uSim.uTexel, 1 / simW, 1 / simH);
    gl.uniform1f(uSim.uDamp, 0.986);
    const n = batch ? Math.min(batch.length, MAX_DROPS) : 0;
    for (let i = 0; i < n; i++) {
      const d = batch[i];
      dropArr[i * 4] = d.x;
      dropArr[i * 4 + 1] = d.y;
      dropArr[i * 4 + 2] = d.r;
      dropArr[i * 4 + 3] = d.s;
    }
    gl.uniform1i(uSim.uDropCount, n);
    if (n) gl.uniform4fv(uSim.uDrops, dropArr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const tmp = bufPrev;
    bufPrev = bufCur;
    bufCur = bufNext;
    bufNext = tmp;
  }

  let lastT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const nowMs = performance.now();
    let dt = (nowMs - lastT) / 1000;
    lastT = nowMs;
    dt = Math.min(dt, 0.05);
    const now = nowMs / 1000;

    const steps = Math.max(1, Math.min(3, Math.round(dt / 0.0166)));
    for (let i = 0; i < steps; i++) simStep(i === 0 && drops.length ? drops : null);
    drops.length = 0;

    gl.useProgram(renProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    bindQuad(renProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufCur.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(uRen.uHeight, 0);
    gl.uniform1i(uRen.uBg, 1);
    gl.uniform2f(uRen.uTexel, 1 / simW, 1 / simH);
    gl.uniform2f(uRen.uRes, W, H);
    let sx = 1, sy = 1;
    if (bgReady) {
      const sAsp = W / H, iAsp = bgW / bgH;
      if (sAsp > iAsp) sy = iAsp / sAsp;
      else sx = sAsp / iAsp;
    }
    gl.uniform2f(uRen.uBgScale, sx, sy);
    gl.uniform1f(uRen.uTime, now);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (window.Life) Life.update(now, dt);
    if (window.Fishing) Fishing.update(now, dt);
    if (window.App && App.frame) App.frame(now, dt);
  }
  requestAnimationFrame(frame);

  window.Water = { addDrop, rippleField };
  setTimeout(() => addDrop(innerWidth * 0.5, innerHeight * 0.45, 30, 1.1), 600);
})();
