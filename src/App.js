import React from 'react';
import './App.css'; // Correct
function App() {
  return (
    <div className="App">
      
    </div>
  );
}

export default App;

// ============================================================
// PIXIFY — Full Photo Editor Engine
// ============================================================

const PhotoEditor = (() => {
  // ── State ──────────────────────────────────────────────────
  let state = {
    originalImage: null,
    workingCanvas: null,
    workingCtx: null,
    displayCanvas: null,
    displayCtx: null,
    history: [],
    historyIndex: -1,
    activePanel: 'adjust',
    activeTool: null,
    crop: { active: false, startX: 0, startY: 0, endX: 0, endY: 0, dragging: false },
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,
    filters: {
      // Basic
      brightness: 0, contrast: 0, saturation: 0, vibrance: 0,
      highlights: 0, shadows: 0, whites: 0, blacks: 0,
      exposure: 0, gamma: 1,
      // Tone
      temperature: 0, tint: 0,
      // Presence
      clarity: 0, dehaze: 0, texture: 0, sharpness: 0,
      // Noise
      noiseReduction: 0, colorNoise: 0,
      // Vignette
      vignette: 0, vignetteFeather: 50,
      // Grain
      grain: 0, grainSize: 25, grainRoughness: 50,
      // Fade
      fade: 0,
      // Blur
      blur: 0,
      // Color
      hue: 0,
      // Curves (stored as bezier points per channel)
      curvesRGB: [[0,0],[255,255]],
      curvesR: [[0,0],[255,255]],
      curvesG: [[0,0],[255,255]],
      curvesB: [[0,0],[255,255]],
      // HSL
      hsl: {
        red:    { h: 0, s: 0, l: 0 },
        orange: { h: 0, s: 0, l: 0 },
        yellow: { h: 0, s: 0, l: 0 },
        green:  { h: 0, s: 0, l: 0 },
        aqua:   { h: 0, s: 0, l: 0 },
        blue:   { h: 0, s: 0, l: 0 },
        purple: { h: 0, s: 0, l: 0 },
        magenta:{ h: 0, s: 0, l: 0 },
      },
      // Active filter preset
      preset: 'none',
      // Flip/Rotate
      flipH: false, flipV: false, rotation: 0,
      // BG
      bgRemoved: false,
      bgBlur: 0,
      bgColor: null,
      // Chroma
      chromaKey: false, chromaColor: '#00ff00', chromaThreshold: 80,
    },
    exportFormat: 'png',
    exportQuality: 92,
    exportWidth: null,
    exportHeight: null,
    searchQuery: '',
    notification: null,
    notifTimer: null,
  };

  // ── DOM helpers ────────────────────────────────────────────
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  // ── Notification ──────────────────────────────────────────
  function notify(msg, type = 'info') {
    const el = $('#notification');
    if (!el) return;
    el.textContent = msg;
    el.className = `notification show ${type}`;
    clearTimeout(state.notifTimer);
    state.notifTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ── Canvas Setup ──────────────────────────────────────────
  function setupCanvas(img) {
    state.workingCanvas = document.createElement('canvas');
    state.workingCanvas.width = img.naturalWidth || img.width;
    state.workingCanvas.height = img.naturalHeight || img.height;
    state.workingCtx = state.workingCanvas.getContext('2d');
    state.workingCtx.drawImage(img, 0, 0);

    state.displayCanvas = $('#mainCanvas');
    state.displayCtx = state.displayCanvas.getContext('2d', { willReadFrequently: true });

    // Update export defaults
    state.exportWidth = state.workingCanvas.width;
    state.exportHeight = state.workingCanvas.height;
    const wEl = $('#exportWidth');
    const hEl = $('#exportHeight');
    if (wEl) wEl.value = state.exportWidth;
    if (hEl) hEl.value = state.exportHeight;

    pushHistory();
    renderImage();
    fitToView();
  }

  function fitToView() {
    const wrap = $('#canvasWrap');
    if (!wrap || !state.workingCanvas) return;
    const ratio = Math.min(
      (wrap.clientWidth - 40) / state.workingCanvas.width,
      (wrap.clientHeight - 40) / state.workingCanvas.height,
      1
    );
    state.zoom = ratio;
    state.panX = 0;
    state.panY = 0;
    applyCanvasTransform();
  }

  function applyCanvasTransform() {
    const c = $('#mainCanvas');
    if (!c) return;
    c.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  }

  // ── History ───────────────────────────────────────────────
  function pushHistory() {
    if (!state.workingCanvas) return;
    const snap = {
      data: state.workingCtx.getImageData(0, 0, state.workingCanvas.width, state.workingCanvas.height),
      filters: JSON.parse(JSON.stringify(state.filters)),
    };
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snap);
    if (state.history.length > 50) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreSnap(state.history[state.historyIndex]);
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreSnap(state.history[state.historyIndex]);
  }

  function restoreSnap(snap) {
    if (!snap || !state.workingCanvas) return;
    state.workingCtx.putImageData(snap.data, 0, 0);
    state.filters = JSON.parse(JSON.stringify(snap.filters));
    syncSlidersToState();
    renderImage();
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    const u = $('#btnUndo'), r = $('#btnRedo');
    if (u) u.disabled = state.historyIndex <= 0;
    if (r) r.disabled = state.historyIndex >= state.history.length - 1;
  }

  // ── Image Processing Core ─────────────────────────────────
  function renderImage() {
    if (!state.workingCanvas || !state.displayCanvas) return;
    const f = state.filters;
    const w = state.workingCanvas.width;
    const h = state.workingCanvas.height;

    state.displayCanvas.width = w;
    state.displayCanvas.height = h;

    // Temp canvas for processing
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');

    // 1. Draw working image
    ctx.drawImage(state.workingCanvas, 0, 0);

    // 2. Get pixel data
    let imgData = ctx.getImageData(0, 0, w, h);
    let data = imgData.data;

    // 3. Apply pixel-level filters
    applyPixelFilters(data, w, h, f);

    ctx.putImageData(imgData, 0, 0);

    // 4. CSS filter chain (GPU-accelerated quick ops)
    const cssFilters = buildCSSFilters(f);

    // 5. Render to display
    const dc = state.displayCtx;
    dc.clearRect(0, 0, w, h);
    dc.filter = cssFilters;
    dc.save();

    // Flip/rotate
    dc.translate(w / 2, h / 2);
    dc.rotate((f.rotation * Math.PI) / 180);
    dc.scale(f.flipH ? -1 : 1, f.flipV ? -1 : 1);
    dc.drawImage(tmp, -w / 2, -h / 2);
    dc.restore();
    dc.filter = 'none';

    // 6. Vignette overlay
    if (f.vignette !== 0) applyVignetteOverlay(dc, w, h, f.vignette, f.vignetteFeather);

    // 7. Grain overlay
    if (f.grain > 0) applyGrainOverlay(dc, w, h, f.grain, f.grainSize);

    // 8. Chroma key overlay indicator
    if (f.chromaKey) renderChromaKeyIndicator(dc, w, h);

    // Update histogram
    requestAnimationFrame(() => drawHistogram(imgData));
  }

  function buildCSSFilters(f) {
    const br = 1 + (f.exposure * 0.5) + (f.brightness / 100);
    const con = 1 + (f.contrast / 100);
    const sat = 1 + (f.saturation / 100);
    const hue = f.hue;
    const blurPx = f.blur / 10;
    return `brightness(${br}) contrast(${con}) saturate(${sat}) hue-rotate(${hue}deg) blur(${blurPx}px)`;
  }

  function applyPixelFilters(data, w, h, f) {
    const len = data.length;

    // Precompute LUTs
    const tempShift = f.temperature / 100;
    const tintShift = f.tint / 100;
    const highlightF = f.highlights / 200;
    const shadowF = f.shadows / 200;
    const whitesF = f.whites / 200;
    const blacksF = f.blacks / 200;
    const clarityF = f.clarity / 100;
    const fadeF = f.fade / 100;
    const dehazeF = f.dehaze / 100;
    const vibF = f.vibrance / 100;
    const textureF = f.texture / 100;

    for (let i = 0; i < len; i += 4) {
      let r = data[i], g = data[i+1], b = data[i+2];

      // Temperature (warm/cool)
      r = clamp(r + tempShift * 30);
      b = clamp(b - tempShift * 30);
      // Tint (green/magenta)
      g = clamp(g + tintShift * 20);
      r = clamp(r - tintShift * 10);

      // Shadows/Highlights
      const lum = (r + g + b) / 765; // 0..1
      if (lum < 0.5) {
        const s = (0.5 - lum) * 2;
        const boost = shadowF * s * 60;
        r = clamp(r + boost); g = clamp(g + boost); b = clamp(b + boost);
        const darkBoost = blacksF * (1 - lum) * 40;
        r = clamp(r + darkBoost); g = clamp(g + darkBoost); b = clamp(b + darkBoost);
      } else {
        const s = (lum - 0.5) * 2;
        const boost = highlightF * s * 60;
        r = clamp(r + boost); g = clamp(g + boost); b = clamp(b + boost);
        const brightBoost = whitesF * lum * 40;
        r = clamp(r + brightBoost); g = clamp(g + brightBoost); b = clamp(b + brightBoost);
      }

      // Vibrance (boost less-saturated colors more)
      if (vibF !== 0) {
        const max = Math.max(r,g,b);
        const min = Math.min(r,g,b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const vibBoost = vibF * (1 - sat);
        const avg = (r+g+b)/3;
        r = clamp(r + (r - avg) * vibBoost);
        g = clamp(g + (g - avg) * vibBoost);
        b = clamp(b + (b - avg) * vibBoost);
      }

      // Dehaze
      if (dehazeF !== 0) {
        const hazeLum = (r+g+b)/765;
        const dehazeBoost = dehazeF * (0.5 - hazeLum) * 80;
        r = clamp(r + dehazeBoost); g = clamp(g + dehazeBoost); b = clamp(b + dehazeBoost);
      }

      // Clarity (local contrast simulation via brightness push)
      if (clarityF !== 0) {
        const cLum = (r*0.299 + g*0.587 + b*0.114) / 255;
        const boost = clarityF * (cLum - 0.5) * 60;
        r = clamp(r + boost); g = clamp(g + boost); b = clamp(b + boost);
      }

      // Texture (edge-like sharpening simulation)
      if (textureF !== 0) {
        const tLum = (r + g + b) / 3;
        const boost = textureF * Math.abs(tLum - 128) / 128 * 20;
        r = clamp(r + boost); g = clamp(g + boost); b = clamp(b + boost);
      }

      // Fade
      if (fadeF !== 0) {
        r = clamp(r + fadeF * (128 - r));
        g = clamp(g + fadeF * (128 - g));
        b = clamp(b + fadeF * (128 - b));
      }

      // Noise
      if (f.noiseReduction > 0) {
        const nr = f.noiseReduction / 100;
        const lum2 = (r+g+b)/3;
        r = clamp(r * (1-nr*0.3) + lum2 * nr*0.3);
        g = clamp(g * (1-nr*0.3) + lum2 * nr*0.3);
        b = clamp(b * (1-nr*0.3) + lum2 * nr*0.3);
      }

      // Color Noise
      if (f.colorNoise > 0) {
        const cn = f.colorNoise / 100;
        const lum3 = r*0.299 + g*0.587 + b*0.114;
        r = clamp(r * (1-cn) + lum3 * cn);
        g = clamp(g * (1-cn) + lum3 * cn);
        b = clamp(b * (1-cn) + lum3 * cn);
      }

      // HSL per-color adjustments
      const [hh, ss, ll] = rgbToHsl(r, g, b);
      const hslAdj = getHSLAdjustment(hh, f.hsl);
      if (hslAdj) {
        const [rr,gg,bb] = hslToRgb(
          ((hh + hslAdj.h/360) + 1) % 1,
          clamp01(ss + hslAdj.s/100),
          clamp01(ll + hslAdj.l/100)
        );
        r = rr; g = gg; b = bb;
      }

      // Chroma key
      if (f.chromaKey) {
        const [cr,cg,cb] = hexToRgb(f.chromaColor);
        const dist = colorDist(r,g,b,cr,cg,cb);
        if (dist < f.chromaThreshold) {
          data[i+3] = 0;
          data[i] = r; data[i+1] = g; data[i+2] = b;
          continue;
        }
      }

      data[i] = r; data[i+1] = g; data[i+2] = b;
    }
  }

  function applyVignetteOverlay(ctx, w, h, amount, feather) {
    const cx = w/2, cy = h/2;
    const r = Math.sqrt(cx*cx + cy*cy);
    const grd = ctx.createRadialGradient(cx, cy, r * (feather/100) * 0.6, cx, cy, r);
    const alpha = Math.abs(amount) / 100;
    const color = amount > 0 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, color);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  function applyGrainOverlay(ctx, w, h, amount, size) {
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = w; grainCanvas.height = h;
    const gc = grainCanvas.getContext('2d');
    const gData = gc.createImageData(w, h);
    const d = gData.data;
    for (let i = 0; i < d.length; i+=4) {
      const n = (Math.random() - 0.5) * 2 * amount * 2.5;
      d[i] = d[i+1] = d[i+2] = 128 + n;
      d[i+3] = amount * 2;
    }
    gc.putImageData(gData, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grainCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function renderChromaKeyIndicator(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(4, 4, w-8, h-8);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#7c3aed';
    ctx.fillText('CHROMA KEY ACTIVE', 12, 22);
    ctx.restore();
  }

  // ── Color Utils ───────────────────────────────────────────
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function colorDist(r1,g1,b1,r2,g2,b2) {
    return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  }

  function rgbToHsl(r,g,b) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}
    else{
      const d=max-min;
      s=l>0.5?d/(2-max-min):d/(max+min);
      switch(max){
        case r:h=(g-b)/d+(g<b?6:0);break;
        case g:h=(b-r)/d+2;break;
        case b:h=(r-g)/d+4;break;
        default:h=0;
      }
      h/=6;
    }
    return [h,s,l];
  }

  function hslToRgb(h,s,l) {
    let r,g,b;
    if(s===0){r=g=b=l;}
    else{
      const q=l<0.5?l*(1+s):l+s-l*s;
      const p=2*l-q;
      r=hue2rgb(p,q,h+1/3);
      g=hue2rgb(p,q,h);
      b=hue2rgb(p,q,h-1/3);
    }
    return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
  }

  function hue2rgb(p,q,t){
    if(t<0)t+=1;if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;
    if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;
    return p;
  }

  function getHSLAdjustment(h, hsl) {
    const deg = h * 360;
    if (deg < 30 || deg >= 330) return hsl.red;
    if (deg < 60) return hsl.orange;
    if (deg < 90) return hsl.yellow;
    if (deg < 150) return hsl.green;
    if (deg < 195) return hsl.aqua;
    if (deg < 255) return hsl.blue;
    if (deg < 285) return hsl.purple;
    if (deg < 330) return hsl.magenta;
    return null;
  }

  // ── Histogram ─────────────────────────────────────────────
  function drawHistogram(imgData) {
    const canvas = $('#histogram');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const data = imgData.data;
    const rH = new Array(256).fill(0);
    const gH = new Array(256).fill(0);
    const bH = new Array(256).fill(0);
    const lH = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      rH[data[i]]++;
      gH[data[i+1]]++;
      bH[data[i+2]]++;
      lH[Math.round(data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114)]++;
    }

    const maxVal = Math.max(...lH, ...rH, ...gH, ...bH);
    ctx.clearRect(0, 0, W, H);

    const drawChannel = (hist, color) => {
      ctx.beginPath();
      ctx.fillStyle = color;
      for (let i = 0; i < 256; i++) {
        const x = (i/255)*W;
        const barH = (hist[i]/maxVal)*H;
        ctx.fillRect(x, H-barH, W/256+1, barH);
      }
    };

    drawChannel(rH, 'rgba(255,80,80,0.5)');
    drawChannel(gH, 'rgba(80,255,80,0.5)');
    drawChannel(bH, 'rgba(80,80,255,0.5)');
    drawChannel(lH, 'rgba(255,255,255,0.3)');
  }

  // ── Filter Presets ────────────────────────────────────────
  const PRESETS = {
    none:       {},
    vivid:      { saturation: 40, clarity: 30, contrast: 20, vibrance: 30 },
    fade:       { fade: 30, shadows: 20, saturation: -10 },
    cinematic:  { contrast: 25, shadows: -20, temperature: -15, fade: 10, vignette: 30 },
    noir:       { saturation: -100, contrast: 40, clarity: 20, vignette: 40 },
    golden:     { temperature: 40, saturation: 20, highlights: 15, vibrance: 20 },
    cool:       { temperature: -40, tint: -10, shadows: 10, saturation: 10 },
    warm:       { temperature: 50, vibrance: 20, highlights: 10 },
    matte:      { blacks: 30, highlights: -10, fade: 20, contrast: -10 },
    vsco:       { fade: 15, temperature: 10, grain: 25, vignette: 20, shadows: 15 },
    analog:     { grain: 40, fade: 20, contrast: 15, temperature: 15, vignette: 30 },
    cyberpunk:  { tint: -40, temperature: -30, saturation: 50, contrast: 30, vibrance: 50 },
    forest:     { temperature: -10, tint: 20, shadows: 20, saturation: 20 },
    sunset:     { temperature: 60, saturation: 30, highlights: 20, vibrance: 30 },
    winter:     { temperature: -50, tint: -20, saturation: -15, clarity: 15 },
    dramatic:   { contrast: 50, clarity: 40, shadows: -30, highlights: 20, vignette: 40 },
    portrait:   { clarity: -10, vibrance: 15, saturation: 5, temperature: 10, fade: 5 },
    landscape:  { clarity: 30, dehaze: 20, saturation: 15, vibrance: 20, contrast: 15 },
    urban:      { contrast: 25, clarity: 20, temperature: -10, fade: 10 },
    pastel:     { saturation: -20, fade: 30, highlights: 20, shadows: 10, brightness: 10 },
    chrome:     { saturation: 30, contrast: 30, highlights: 20, shadows: -20, temperature: 10 },
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    const defaults = {
      brightness:0,contrast:0,saturation:0,vibrance:0,highlights:0,shadows:0,
      whites:0,blacks:0,exposure:0,temperature:0,tint:0,clarity:0,dehaze:0,
      texture:0,sharpness:0,noiseReduction:0,colorNoise:0,vignette:0,
      vignetteFeather:50,grain:0,grainSize:25,fade:0,blur:0,hue:0
    };
    Object.assign(state.filters, defaults, p);
    syncSlidersToState();
    renderImage();
    pushHistory();
    notify(`Preset "${name}" applied`, 'success');
  }

  // ── Sliders / UI sync ─────────────────────────────────────
  function syncSlidersToState() {
    const f = state.filters;
    const sliders = [
      'brightness','contrast','saturation','vibrance','highlights','shadows',
      'whites','blacks','exposure','temperature','tint','clarity','dehaze',
      'texture','sharpness','noiseReduction','colorNoise','vignette',
      'vignetteFeather','grain','grainSize','grainRoughness','fade','blur','hue',
      'bgBlur','chromaThreshold'
    ];
    sliders.forEach(k => {
      const el = $(`#slider-${k}`);
      if (el) {
        el.value = f[k] ?? el.value;
        const vEl = $(`#val-${k}`);
        if (vEl) vEl.textContent = el.value;
      }
    });
    ['red','orange','yellow','green','aqua','blue','purple','magenta'].forEach(color => {
      ['h','s','l'].forEach(prop => {
        const el = $(`#hsl-${color}-${prop}`);
        if (el) {
          el.value = f.hsl[color][prop];
          const vEl = $(`#hsl-${color}-${prop}-val`);
          if (vEl) vEl.textContent = el.value;
        }
      });
    });
  }

  function initSlider(id, filterKey, min, max, step, subKey) {
    const el = $(`#slider-${id}`);
    if (!el) return;
    el.min = min; el.max = max; el.step = step ?? 1;
    el.value = subKey ? state.filters[filterKey][subKey] : state.filters[filterKey];
    const vEl = $(`#val-${id}`);
    if (vEl) vEl.textContent = el.value;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (subKey) state.filters[filterKey][subKey] = v;
      else state.filters[filterKey] = v;
      if (vEl) vEl.textContent = el.value;
      renderImage();
    });
    el.addEventListener('change', () => pushHistory());
  }

  // ── Upload ─────────────────────────────────────────────────
  function handleUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      notify('Please upload a valid image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        state.originalImage = img;
        resetAllFilters();
        setupCanvas(img);
        $('#welcomeScreen').style.display = 'none';
        $('#editorScreen').style.display = 'flex';
        notify(`Image loaded (${img.naturalWidth}×${img.naturalHeight})`, 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetAllFilters() {
    state.filters = {
      brightness:0,contrast:0,saturation:0,vibrance:0,highlights:0,shadows:0,
      whites:0,blacks:0,exposure:0,gamma:1,temperature:0,tint:0,clarity:0,
      dehaze:0,texture:0,sharpness:0,noiseReduction:0,colorNoise:0,
      vignette:0,vignetteFeather:50,grain:0,grainSize:25,grainRoughness:50,
      fade:0,blur:0,hue:0,
      curvesRGB:[[0,0],[255,255]],curvesR:[[0,0],[255,255]],
      curvesG:[[0,0],[255,255]],curvesB:[[0,0],[255,255]],
      hsl:{
        red:{h:0,s:0,l:0},orange:{h:0,s:0,l:0},yellow:{h:0,s:0,l:0},
        green:{h:0,s:0,l:0},aqua:{h:0,s:0,l:0},blue:{h:0,s:0,l:0},
        purple:{h:0,s:0,l:0},magenta:{h:0,s:0,l:0}
      },
      preset:'none',flipH:false,flipV:false,rotation:0,
      bgRemoved:false,bgBlur:0,bgColor:null,
      chromaKey:false,chromaColor:'#00ff00',chromaThreshold:80
    };
    state.history = [];
    state.historyIndex = -1;
  }

  // ── Crop Tool ─────────────────────────────────────────────
  function initCropTool() {
    const canvas = $('#mainCanvas');
    if (!canvas) return;
    let startX, startY, isDragging = false;

    canvas.addEventListener('mousedown', (e) => {
      if (state.activeTool !== 'crop') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = state.workingCanvas.width / rect.width;
      const scaleY = state.workingCanvas.height / rect.height;
      startX = (e.clientX - rect.left) * scaleX;
      startY = (e.clientY - rect.top) * scaleY;
      isDragging = true;
      state.crop = { active: true, startX, startY, endX: startX, endY: startY };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging || state.activeTool !== 'crop') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = state.workingCanvas.width / rect.width;
      const scaleY = state.workingCanvas.height / rect.height;
      state.crop.endX = (e.clientX - rect.left) * scaleX;
      state.crop.endY = (e.clientY - rect.top) * scaleY;
      drawCropOverlay();
    });

    canvas.addEventListener('mouseup', () => {
      if (state.activeTool !== 'crop' || !isDragging) return;
      isDragging = false;
    });
  }

  function drawCropOverlay() {
    const c = state.crop;
    const ctx = state.displayCtx;
    renderImage();
    if (!c.active) return;
    const x = Math.min(c.startX, c.endX);
    const y = Math.min(c.startY, c.endY);
    const w = Math.abs(c.endX - c.startX);
    const h = Math.abs(c.endY - c.startY);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, state.workingCanvas.width, y);
    ctx.fillRect(0, y+h, state.workingCanvas.width, state.workingCanvas.height);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x+w, y, state.workingCanvas.width, h);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(168,85,247,0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + w*i/3, y); ctx.lineTo(x + w*i/3, y+h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h*i/3); ctx.lineTo(x+w, y + h*i/3); ctx.stroke();
    }
  }

  function applyCrop() {
    const c = state.crop;
    if (!c.active || !state.workingCanvas) return;
    const x = Math.max(0, Math.min(c.startX, c.endX));
    const y = Math.max(0, Math.min(c.startY, c.endY));
    const w = Math.min(Math.abs(c.endX - c.startX), state.workingCanvas.width - x);
    const h = Math.min(Math.abs(c.endY - c.startY), state.workingCanvas.height - y);
    if (w < 10 || h < 10) { notify('Selection too small', 'error'); return; }

    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(state.workingCanvas, x, y, w, h, 0, 0, w, h);
    state.workingCanvas.width = w; state.workingCanvas.height = h;
    state.workingCtx.drawImage(tmp, 0, 0);
    state.crop = { active: false };
    state.activeTool = null;
    state.exportWidth = w; state.exportHeight = h;
    const wEl = $('#exportWidth'); const hEl = $('#exportHeight');
    if (wEl) wEl.value = w; if (hEl) hEl.value = h;
    pushHistory();
    renderImage();
    notify('Crop applied', 'success');
  }

  // ── Rotate/Flip ───────────────────────────────────────────
  function rotateImage(deg) {
    if (!state.workingCanvas) return;
    const w = state.workingCanvas.width, h = state.workingCanvas.height;
    const tmp = document.createElement('canvas');
    const abs = Math.abs(deg) === 90 || Math.abs(deg) === 270;
    tmp.width = abs ? h : w; tmp.height = abs ? w : h;
    const ctx = tmp.getContext('2d');
    ctx.translate(tmp.width/2, tmp.height/2);
    ctx.rotate(deg * Math.PI/180);
    ctx.drawImage(state.workingCanvas, -w/2, -h/2);
    state.workingCanvas.width = tmp.width; state.workingCanvas.height = tmp.height;
    state.workingCtx.drawImage(tmp, 0, 0);
    pushHistory(); renderImage();
    notify(`Rotated ${deg > 0 ? 'right' : 'left'}`, 'success');
  }

  function flipImage(axis) {
    if (!state.workingCanvas) return;
    state.filters[axis === 'h' ? 'flipH' : 'flipV'] = !state.filters[axis === 'h' ? 'flipH' : 'flipV'];
    pushHistory(); renderImage();
    notify(`Flipped ${axis === 'h' ? 'horizontally' : 'vertically'}`, 'success');
  }

  // ── BG Remover ────────────────────────────────────────────
  function removeBG() {
    if (!state.workingCanvas) { notify('No image loaded', 'error'); return; }
    notify('Processing background removal…', 'info');
    setTimeout(() => {
      const w = state.workingCanvas.width, h = state.workingCanvas.height;
      const imgData = state.workingCtx.getImageData(0, 0, w, h);
      const d = imgData.data;

      const corners = [
        [d[0],d[1],d[2]],
        [d[(w-1)*4],d[(w-1)*4+1],d[(w-1)*4+2]],
        [d[(h-1)*w*4],d[(h-1)*w*4+1],d[(h-1)*w*4+2]],
        [d[((h-1)*w+(w-1))*4],d[((h-1)*w+(w-1))*4+1],d[((h-1)*w+(w-1))*4+2]]
      ];
      const avgBG = corners.reduce((a,c)=>[a[0]+c[0]/4,a[1]+c[1]/4,a[2]+c[2]/4],[0,0,0]);
      const threshold = 80;

      for (let i = 0; i < d.length; i += 4) {
        const dist = colorDist(d[i],d[i+1],d[i+2],avgBG[0],avgBG[1],avgBG[2]);
        if (dist < threshold) d[i+3] = 0;
      }
      state.workingCtx.putImageData(imgData, 0, 0);
      pushHistory(); renderImage();
      notify('Background removed! Tip: Use Chroma Key for precise removal.', 'success');
    }, 50);
  }

  // ── Export ─────────────────────────────────────────────────
  function exportImage() {
    if (!state.displayCanvas) { notify('No image to export', 'error'); return; }
    const fmt = state.exportFormat;
    const q = state.exportQuality / 100;
    const targetW = parseInt($('#exportWidth')?.value) || state.displayCanvas.width;
    const targetH = parseInt($('#exportHeight')?.value) || state.displayCanvas.height;

    const tmp = document.createElement('canvas');
    tmp.width = targetW; tmp.height = targetH;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(state.displayCanvas, 0, 0, targetW, targetH);

    let mimeType = 'image/png';
    let ext = 'png';
    if (fmt === 'jpg' || fmt === 'jpeg') { mimeType = 'image/jpeg'; ext = 'jpg'; }
    else if (fmt === 'webp') { mimeType = 'image/webp'; ext = 'webp'; }
    else if (fmt === 'avif') { mimeType = 'image/avif'; ext = 'avif'; }

    const dataURL = tmp.toDataURL(mimeType, q);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `pixify-export.${ext}`;
    a.click();
    notify(`Exported as ${ext.toUpperCase()} (${targetW}×${targetH})`, 'success');
  }

  function exportAsSVG() {
    if (!state.displayCanvas) return;
    const w = state.displayCanvas.width, h = state.displayCanvas.height;
    const dataURL = state.displayCanvas.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="${dataURL}" width="${w}" height="${h}"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pixify-export.svg';
    a.click();
    notify('Exported as SVG', 'success');
  }

  // ── Zoom ──────────────────────────────────────────────────
  function handleZoom(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    state.zoom = Math.max(0.1, Math.min(8, state.zoom * delta));
    applyCanvasTransform();
  }

  // ── Panel switching ───────────────────────────────────────
  function switchPanel(name) {
    state.activePanel = name;
    $$('.panel-section').forEach(el => el.classList.remove('active'));
    const target = $(`#panel-${name}`);
    if (target) target.classList.add('active');
    $$('.sidebar-tab').forEach(el => el.classList.remove('active'));
    const tab = $(`[data-panel="${name}"]`);
    if (tab) tab.classList.add('active');
  }

  // ── Search ────────────────────────────────────────────────
  function handleSearch(q) {
    state.searchQuery = q.toLowerCase();
    $$('.tool-item, .slider-row, .preset-card, .panel-group').forEach(el => {
      const text = el.textContent.toLowerCase();
      const show = !q || text.includes(state.searchQuery);
      el.style.display = show ? '' : 'none';
    });
  }

  // ── Reset ─────────────────────────────────────────────────
  function resetToOriginal() {
    if (!state.originalImage) return;
    resetAllFilters();
    setupCanvas(state.originalImage);
    syncSlidersToState();
    notify('Reset to original', 'info');
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    const uploadInput = $('#uploadInput');
    const dropZone = $('#dropZone');
    const uploadBtn = $('#uploadBtn');
    const newImageBtn = $('#newImageBtn');

    if (uploadBtn) uploadBtn.addEventListener('click', () => uploadInput?.click());
    if (newImageBtn) newImageBtn.addEventListener('click', () => {
      $('#editorScreen').style.display = 'none';
      $('#welcomeScreen').style.display = 'flex';
    });

    if (uploadInput) uploadInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    if (dropZone) {
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
      });
    }

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          handleUpload(item.getAsFile());
          break;
        }
      }
    });

    $$('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
    });

    const adjustSliders = [
      ['exposure', 'exposure', -3, 3, 0.1],
      ['brightness', 'brightness', -100, 100, 1],
      ['contrast', 'contrast', -100, 100, 1],
      ['highlights', 'highlights', -100, 100, 1],
      ['shadows', 'shadows', -100, 100, 1],
      ['whites', 'whites', -100, 100, 1],
      ['blacks', 'blacks', -100, 100, 1],
      ['saturation', 'saturation', -100, 100, 1],
      ['vibrance', 'vibrance', -100, 100, 1],
      ['temperature', 'temperature', -100, 100, 1],
      ['tint', 'tint', -100, 100, 1],
      ['clarity', 'clarity', -100, 100, 1],
      ['dehaze', 'dehaze', -100, 100, 1],
      ['texture', 'texture', -100, 100, 1],
      ['sharpness', 'sharpness', 0, 100, 1],
      ['noiseReduction', 'noiseReduction', 0, 100, 1],
      ['colorNoise', 'colorNoise', 0, 100, 1],
      ['vignette', 'vignette', -100, 100, 1],
      ['vignetteFeather', 'vignetteFeather', 0, 100, 1],
      ['grain', 'grain', 0, 100, 1],
      ['grainSize', 'grainSize', 1, 100, 1],
      ['fade', 'fade', 0, 100, 1],
      ['blur', 'blur', 0, 100, 1],
      ['hue', 'hue', -180, 180, 1],
    ];
    adjustSliders.forEach(([id, key, min, max, step]) => initSlider(id, key, min, max, step));

    ['red','orange','yellow','green','aqua','blue','purple','magenta'].forEach(color => {
      ['h','s','l'].forEach(prop => {
        const el = $(`#hsl-${color}-${prop}`);
        if (!el) return;
        el.addEventListener('input', () => {
          state.filters.hsl[color][prop] = parseFloat(el.value);
          const vEl = $(`#hsl-${color}-${prop}-val`);
          if (vEl) vEl.textContent = el.value;
          renderImage();
        });
        el.addEventListener('change', () => pushHistory());
      });
    });

    $$('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('.preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        applyPreset(card.dataset.preset);
      });
    });

    const toolBtns = {
      'btn-crop': () => {
        state.activeTool = state.activeTool === 'crop' ? null : 'crop';
        $('#mainCanvas').style.cursor = state.activeTool === 'crop' ? 'crosshair' : 'default';
        notify(state.activeTool === 'crop' ? 'Draw a selection to crop' : 'Crop cancelled', 'info');
      },
      'btn-apply-crop': applyCrop,
      'btn-rotate-l': () => rotateImage(-90),
      'btn-rotate-r': () => rotateImage(90),
      'btn-flip-h': () => flipImage('h'),
      'btn-flip-v': () => flipImage('v'),
      'btn-bg-remove': removeBG,
      'btn-reset': resetToOriginal,
      'btn-export': exportImage,
      'btn-export-svg': exportAsSVG,
    };

    Object.entries(toolBtns).forEach(([id, fn]) => {
      const el = $(`#${id}`);
      if (el) el.addEventListener('click', fn);
    });

    $('#btnUndo')?.addEventListener('click', undo);
    $('#btnRedo')?.addEventListener('click', redo);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); exportImage(); }
    });

    $('#canvasWrap')?.addEventListener('wheel', handleZoom, { passive: false });
    $('#btnZoomIn')?.addEventListener('click', () => { state.zoom = Math.min(8, state.zoom*1.2); applyCanvasTransform(); });
    $('#btnZoomOut')?.addEventListener('click', () => { state.zoom = Math.max(0.1, state.zoom*0.8); applyCanvasTransform(); });
    $('#btnZoomFit')?.addEventListener('click', fitToView);

    const cw = $('#canvasWrap');
    if (cw) {
      cw.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && state.activeTool === 'pan')) {
          state.isPanning = true; state.lastPanX = e.clientX; state.lastPanY = e.clientY;
          cw.style.cursor = 'grabbing';
        }
      });
      cw.addEventListener('mousemove', (e) => {
        if (!state.isPanning) return;
        state.panX += e.clientX - state.lastPanX;
        state.panY += e.clientY - state.lastPanY;
        state.lastPanX = e.clientX; state.lastPanY = e.clientY;
        applyCanvasTransform();
      });
      cw.addEventListener('mouseup', () => { state.isPanning = false; cw.style.cursor = ''; });
      cw.addEventListener('mouseleave', () => { state.isPanning = false; });
    }

    $('#exportFormat')?.addEventListener('change', (e) => { state.exportFormat = e.target.value; });
    $('#exportQuality')?.addEventListener('input', (e) => {
      state.exportQuality = parseInt(e.target.value);
      const v = $('#val-exportQuality');
      if (v) v.textContent = state.exportQuality;
    });

    $('#slider-bgBlur')?.addEventListener('input', (e) => {
      state.filters.bgBlur = parseInt(e.target.value);
      const v = $('#val-bgBlur');
      if (v) v.textContent = e.target.value;
      renderImage();
    });

    $('#chromaColorPick')?.addEventListener('input', (e) => {
      state.filters.chromaColor = e.target.value;
      if(state.filters.chromaKey) renderImage();
    });
    $('#slider-chromaThreshold')?.addEventListener('input', (e) => {
      state.filters.chromaThreshold = parseInt(e.target.value);
      const v = $('#val-chromaThreshold');
      if (v) v.textContent = e.target.value;
      if (state.filters.chromaKey) renderImage();
    });
    $('#chromaToggle')?.addEventListener('click', () => {
      state.filters.chromaKey = !state.filters.chromaKey;
      const btn = $('#chromaToggle');
      if (btn) {
        btn.textContent = state.filters.chromaKey ? 'Disable Chroma Key' : 'Enable Chroma Key';
        btn.classList.toggle('active', state.filters.chromaKey);
      }
      renderImage();
      notify(state.filters.chromaKey ? 'Chroma key enabled' : 'Chroma key disabled', 'info');
    });

    $('#slider-rotation')?.addEventListener('input', (e) => {
      state.filters.rotation = parseFloat(e.target.value);
      const v = $('#val-rotation');
      if (v) v.textContent = e.target.value;
      renderImage();
    });

    $('#searchInput')?.addEventListener('input', (e) => handleSearch(e.target.value));

    initCurvesCanvas();
    initCropTool();

    $('#conversionUpload')?.addEventListener('change', (e) => {
      if (e.target.files[0]) convertFile(e.target.files[0]);
    });

    $('#mobileSidebarToggle')?.addEventListener('click', () => {
      $('#sidebar').classList.toggle('mobile-open');
    });

    notify('Welcome to Pixify — Upload an image to begin', 'info');
  }

  // ── Curves Canvas ─────────────────────────────────────────
  function initCurvesCanvas() {
    const canvas = $('#curvesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dragging = null;
    let channel = 'RGB';

    const channelKeys = { RGB:'curvesRGB', R:'curvesR', G:'curvesG', B:'curvesB' };

    function getPoints() {
      const key = channelKeys[channel];
      return state.filters[key].map(([x,y])=>[x, 255-y]);
    }
    function setPoints(pts) {
      const key = channelKeys[channel];
      state.filters[key] = pts.map(([x,y])=>[x, 255-y]);
    }

    function draw() {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(i*W/4, 0); ctx.lineTo(i*W/4, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i*H/4); ctx.lineTo(W, i*H/4); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(W,0); ctx.stroke();

      const pts = getPoints();
      const channelColor = { RGB:'#fff', R:'#f87171', G:'#4ade80', B:'#60a5fa' };
      ctx.strokeStyle = channelColor[channel];
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.sort((a,b)=>a[0]-b[0]).forEach(([x,y],i) => {
        const px = (x/255)*W, py = (y/255)*H;
        if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      });
      ctx.stroke();

      pts.forEach(([x,y]) => {
        ctx.beginPath();
        ctx.arc((x/255)*W,(y/255)*H,5,0,Math.PI*2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * 255;
      const my = (e.clientY - rect.top) / rect.height * 255;
      const pts = getPoints();
      for (let i = 0; i < pts.length; i++) {
        if (Math.abs(pts[i][0]-mx)<12 && Math.abs(pts[i][1]-my)<12) { dragging=i; return; }
      }
      pts.push([mx, my]);
      setPoints(pts);
      dragging = pts.length - 1;
      draw(); renderImage();
    });

    canvas.addEventListener('mousemove', (e) => {
      if (dragging === null) return;
      const rect = canvas.getBoundingClientRect();
      const mx = Math.max(0,Math.min(255,(e.clientX - rect.left) / rect.width * 255));
      const my = Math.max(0,Math.min(255,(e.clientY - rect.top) / rect.height * 255));
      const pts = getPoints();
      pts[dragging] = [mx, my];
      setPoints(pts);
      draw(); renderImage();
    });

    canvas.addEventListener('mouseup', () => {
      dragging = null; pushHistory();
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width * 255;
      const my = (e.clientY - rect.top) / rect.height * 255;
      const pts = getPoints();
      if (pts.length <= 2) return;
      const idx = pts.findIndex(([x,y])=>Math.abs(x-mx)<12&&Math.abs(y-my)<12);
      if (idx > -1) { pts.splice(idx,1); setPoints(pts); draw(); renderImage(); }
    });

    $$('.curve-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        channel = btn.dataset.channel;
        $$('.curve-channel-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        draw();
      });
    });

    draw();
    state._drawCurves = draw;
  }

  // ── Conversion ────────────────────────────────────────────
  function convertFile(file) {
    const targetFmt = $('#conversionFormat')?.value || 'png';
    if (!file.type.startsWith('image/')) { notify('Not a valid image', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth; tmp.height = img.naturalHeight;
        tmp.getContext('2d').drawImage(img,0,0);

        let mime = 'image/png', ext = 'png';
        if (targetFmt==='jpg'){mime='image/jpeg';ext='jpg';}
        else if (targetFmt==='webp'){mime='image/webp';ext='webp';}
        else if (targetFmt==='avif'){mime='image/avif';ext='avif';}

        if (targetFmt === 'svg') { exportAsSVGDirect(tmp, file.name); return; }

        const a = document.createElement('a');
        a.href = tmp.toDataURL(mime, 0.92);
        a.download = file.name.replace(/\.[^.]+$/, `.${ext}`);
        a.click();
        notify(`Converted to ${ext.toUpperCase()}`, 'success');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function exportAsSVGDirect(canvas, originalName) {
    const dataURL = canvas.toDataURL('image/png');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataURL}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = originalName.replace(/\.[^.]+$/, '.svg');
    a.click();
    notify('Converted to SVG', 'success');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PhotoEditor.init());