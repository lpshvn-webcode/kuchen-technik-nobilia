// Rendering engine for the showroom: a photo + depth map drawn with WebGL2
// (parallax), with a plain 2D-canvas fallback. No dependencies.
const BASE_ZOOM = 1.045; // slack for parallax so edges never show

const VERT = `#version 300 es
out vec2 vUv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=vec2(p.x,1.0-p.y);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;out vec4 o;
uniform sampler2D uTex,uDepth;
uniform vec4 uView;uniform vec2 uShift;uniform float uAlpha,uHasDepth,uLight;
void main(){
 vec2 uv=uView.xy+vUv*uView.zw;vec2 p=uv;
 if(uHasDepth>.5){for(int i=0;i<4;i++){p=uv+uShift*(texture(uDepth,clamp(p,0.0,1.0)).r-.5);}}
 p=clamp(p,vec2(.001),vec2(.999));
 vec3 c=texture(uTex,p).rgb;
 vec2 q=vUv-.5;c*=1.0-uLight*dot(q,q)*.22;
 o=vec4(c,uAlpha);
}`;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Visible rectangle of the image (in 0..1 uv) for a camera {x,y,z} at aspect ar.
export function viewRect(layer, cam, ar) {
  const ia = layer.w / layer.h;
  let vw, vh;
  if (ar > ia) { vw = 1; vh = ia / ar; } else { vh = 1; vw = ar / ia; }
  const z = cam.z * BASE_ZOOM;
  vw /= z; vh /= z;
  return {
    x0: clamp(cam.x - vw / 2, 0, 1 - vw),
    y0: clamp(cam.y - vh / 2, 0, 1 - vh),
    vw, vh
  };
}

// Keep the camera centre inside the image.
export function clampCam(layer, cam, ar) {
  const r = viewRect(layer, cam, ar);
  return { x: r.x0 + r.vw / 2, y: r.y0 + r.vh / 2, z: cam.z };
}

export function sampleDepth(layer, u, v) {
  const d = layer.depthData;
  if (!d) return .5;
  const x = clamp(u, 0, 1) * (d.w - 1), y = clamp(v, 0, 1) * (d.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(d.w - 1, x0 + 1), y1 = Math.min(d.h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0, g = (i, j) => d.data[j * d.w + i] / 255;
  return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
}

let avifFirst = true;
export async function loadBitmap(base, formats, signal) {
  const list = formats.slice();
  if (!avifFirst) list.sort((a, b) => (a === 'avif') - (b === 'avif'));
  let lastError;
  for (const ext of list) {
    try {
      const res = await fetch(`${base}.${ext}`, { signal });
      if (!res.ok) throw new Error(`${res.status} ${base}.${ext}`);
      const blob = await res.blob();
      if (window.createImageBitmap) return await createImageBitmap(blob, { premultiplyAlpha: 'none' });
      return await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(blob);
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (ext === 'avif') avifFirst = false;
      lastError = error;
    }
  }
  throw lastError || new Error('Image failed to load');
}

function readDepth(bitmap) {
  const w = 160, h = Math.max(2, Math.round(160 * bitmap.height / bitmap.width));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data, data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4];
  return { w, h, data };
}

export class Stage {
  constructor(host) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sr-canvas';
    host.prepend(this.canvas);
    this.layers = new Set();
    this.gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.mode = this.gl ? 'webgl' : '2d';
    if (this.gl) this.initGL(); else this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.cw = 1; this.ch = 1; this.dpr = 1;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.onLost = e => { e.preventDefault(); this.lost = true; };
    this.canvas.addEventListener('webglcontextlost', this.onLost);
  }
  get aspect() { return this.cw / this.ch; }
  initGL() {
    const gl = this.gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    this.u = Object.fromEntries(['uTex', 'uDepth', 'uView', 'uShift', 'uAlpha', 'uHasDepth', 'uLight'].map(n => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1i(this.u.uTex, 0); gl.uniform1i(this.u.uDepth, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(.09, .1, .09, 1);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  }
  resize() {
    const rect = this.host.getBoundingClientRect();
    this.cw = Math.max(1, rect.width); this.ch = Math.max(1, rect.height);
    let dpr = Math.min(devicePixelRatio || 1, 2);
    while (dpr > 1 && this.cw * this.ch * dpr * dpr > 3.4e6) dpr -= .25;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cw * dpr); this.canvas.height = Math.round(this.ch * dpr);
    this.onresize?.();
  }
  texture(bitmap, linearMip = true) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    if (linearMip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (linearMip && this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }
  // bitmap: colour image, depthBitmap: optional grayscale image
  createLayer(bitmap, depthBitmap) {
    const layer = { w: bitmap.width, h: bitmap.height, depthData: depthBitmap ? readDepth(depthBitmap) : null };
    if (this.mode === 'webgl') {
      layer.tex = this.texture(bitmap);
      layer.depthTex = depthBitmap ? this.texture(depthBitmap, false) : null;
    } else layer.img = bitmap;
    this.layers.add(layer);
    return layer;
  }
  // swap in a higher resolution image (same aspect) without changing the layer identity
  upgradeLayer(layer, bitmap) {
    if (this.mode === 'webgl') { this.gl.deleteTexture(layer.tex); layer.tex = this.texture(bitmap); } else layer.img = bitmap;
    layer.w = bitmap.width; layer.h = bitmap.height;
  }
  disposeLayer(layer) {
    if (this.mode === 'webgl') { this.gl.deleteTexture(layer.tex); if (layer.depthTex) this.gl.deleteTexture(layer.depthTex); }
    this.layers.delete(layer);
  }
  // items: [{layer, cam:{x,y,z}, alpha}], shift:{x,y} in -1..1, strength in uv-fraction
  render(items, shift, strength = .03, light = 1) {
    if (this.lost) return;
    const ar = this.aspect;
    if (this.mode === 'webgl') {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      let first = true;
      for (const it of items) {
        if (it.alpha <= .001) continue;
        const r = viewRect(it.layer, it.cam, ar), L = it.layer;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, L.tex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L.depthTex || L.tex);
        gl.uniform4f(this.u.uView, r.x0, r.y0, r.vw, r.vh);
        gl.uniform2f(this.u.uShift, shift.x * strength * r.vw, shift.y * strength * r.vh * .6);
        gl.uniform1f(this.u.uAlpha, first ? 1 : it.alpha);
        gl.uniform1f(this.u.uHasDepth, L.depthTex && strength > 0 ? 1 : 0);
        gl.uniform1f(this.u.uLight, light);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        first = false;
      }
    } else {
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      ctx.globalAlpha = 1; ctx.fillStyle = '#171a17'; ctx.fillRect(0, 0, W, H);
      let first = true;
      for (const it of items) {
        if (it.alpha <= .001) continue;
        const r = viewRect(it.layer, it.cam, ar), L = it.layer;
        ctx.globalAlpha = first ? 1 : it.alpha;
        ctx.drawImage(L.img, r.x0 * L.w, r.y0 * L.h, r.vw * L.w, r.vh * L.h, 0, 0, W, H);
        first = false;
      }
      ctx.globalAlpha = 1;
    }
  }
  // screen position (css px) of an image point, accounting for parallax
  project(layer, cam, shift, strength, u, v) {
    const r = viewRect(layer, cam, this.aspect);
    const d = sampleDepth(layer, u, v) - .5;
    const su = u - shift.x * strength * r.vw * d, sv = v - shift.y * strength * r.vh * .6 * d;
    return { x: (su - r.x0) / r.vw * this.cw, y: (sv - r.y0) / r.vh * this.ch, inside: su >= r.x0 && su <= r.x0 + r.vw && sv >= r.y0 && sv <= r.y0 + r.vh };
  }
  destroy() {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    for (const l of [...this.layers]) this.disposeLayer(l);
    if (this.gl) { this.gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    this.canvas.remove();
  }
}
