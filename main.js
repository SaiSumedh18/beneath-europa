/* Beneath Europa: a scroll-driven descent from Jovian orbit to Europa's subsurface ocean.
   Two scenes share one camera: SPACE (Europa, Jupiter, stars) and DEPTH (ice shell, cryobot, ocean).
   Scroll position becomes a continuous "story position" s (chapter index + fraction), and every
   camera move, light and telemetry value is a function of s. */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------------- Smooth scroll (Lenis) wired into ScrollTrigger ---------------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    try { lenis = new Lenis({ lerp: 0.085, smoothWheel: true }); } catch (e) { lenis = null; }
  }
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (lenis) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  } else if (lenis) {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  function goTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(id === "top" ? 0 : el, { duration: 2.2 });
    else window.scrollTo({ top: id === "top" ? 0 : el.offsetTop, behavior: reduce ? "auto" : "smooth" });
  }
  document.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", (e) => { e.preventDefault(); goTo(b.dataset.goto); }));

  /* ---------------- Story position ---------------- */
  const chapters = [...document.querySelectorAll(".chapter")];
  let tops = [], heights = [];
  function measure() { tops = chapters.map((c) => c.offsetTop); heights = chapters.map((c) => c.offsetHeight); }
  measure();
  addEventListener("resize", measure);
  addEventListener("load", measure);
  function storyPos() {
    const y = window.scrollY;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (y >= tops[i]) return i + clamp((y - tops[i]) / heights[i], 0, 1);
    }
    return 0;
  }

  /* ---------------- Mission elapsed time ---------------- */
  const met = $("#met"), t0 = Date.now();
  const pad = (n) => String(n).padStart(2, "0");
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    met.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }, 1000);

  /* ---------------- Text choreography ---------------- */
  if (hasGsap && !reduce) {
    gsap.from(".hero h1 .line > span", { yPercent: 105, duration: 1.4, ease: "expo.out", stagger: 0.12, delay: 0.5 });
    gsap.from(".hero .lede, .hero .eyebrow, .hero .cue", { y: 24, opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.08, delay: 0.8 });
    document.querySelectorAll(".reveal").forEach((panel) => {
      gsap.from(panel.children, {
        y: 36, opacity: 0.15, duration: 1.1, ease: "expo.out", stagger: 0.07,
        scrollTrigger: { trigger: panel, start: "top 82%" },
      });
    });
  }

  /* ---------------- HUD + rail ---------------- */
  const hud = $(".hud"), hudPhase = $("#hud-phase"), hudK1 = $("#hud-k1"), hudV1 = $("#hud-v1"), hudV2 = $("#hud-v2"), hudBar = $("#hud-bar");
  const railBtns = [...document.querySelectorAll(".rail button")];
  let lastHud = 0;
  function updateHud(s, alt, depth, now) {
    if (now - lastHud < 90) return;
    lastHud = now;
    let phase;
    if (s < 1) phase = "APPROACH";
    else if (s < 2) phase = "TARGET · EUROPA";
    else if (s < 3) phase = "JOVIAN ORBIT";
    else if (s < 3.72) phase = "POWERED DESCENT";
    else if (depth < 20) phase = "ICE SHELL";
    else phase = "SUBSURFACE OCEAN";
    hudPhase.textContent = phase;
    hud.classList.toggle("bio", depth >= 20);
    if (s < 3.72) {
      hudK1.textContent = "ALTITUDE";
      hudV1.textContent = `${Math.max(0, Math.round(alt)).toLocaleString("en-US")} km`;
      hudV2.textContent = "−160 °C";
    } else {
      hudK1.textContent = "DEPTH";
      hudV1.textContent = `${depth.toFixed(depth < 20 ? 2 : 1)} km`;
      const temp = depth < 20 ? lerp(-160, -4, Math.pow(depth / 20, 1.3)) : -1;
      hudV2.textContent = `${temp < 0 ? "−" : ""}${Math.abs(Math.round(temp))} °C`;
    }
    hudBar.style.width = `${clamp(s / (chapters.length - 1), 0, 1) * 100}%`;
    const active = s < 0.5 ? 0 : Math.floor(s + 0.35);
    let on = 0;
    railBtns.forEach((b, i) => { if (+b.dataset.i <= active) on = i; });
    railBtns.forEach((b, i) => b.classList.toggle("on", i === on));
  }

  /* ---------------- WebGL ---------------- */
  const loader = $("#loader");
  const hideLoader = () => loader.classList.add("done");
  if (!window.THREE) { document.body.classList.add("no-gl"); hideLoader(); fallbackLoop(); return; }
  try { initGL(); } catch (err) {
    console.warn("WebGL scene unavailable:", err);
    document.body.classList.add("no-gl"); hideLoader(); fallbackLoop();
  }
  setTimeout(hideLoader, 4000); // never leave the loader up

  function fallbackLoop() {
    const tick = (now) => { const s = storyPos(); updateHud(s, (1 - clamp(s / 3.7, 0, 1)) * 8500, Math.max(0, (s - 3.7) / 2.3 * 20), now); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  function initGL() {
    const canvas = $("#gl");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    renderer.setPixelRatio(DPR);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
    const SUN = new THREE.Vector3(0.78, 0.28, 0.56).normalize();

    /* ---- shared GLSL: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) ---- */
    const NOISE = `
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
      float snoise(vec3 v){
        const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
        vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
        vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
        vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
        i=mod289(i);
        vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
        float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
        vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
        vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
        vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
        vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
        vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
        vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
        vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
        p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
        vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
        return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
      }
      float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*snoise(p); p=p*2.07+vec3(1.3,-0.7,2.1); a*=0.5; } return s; }
    `;
    const PLANET_VERT = `
      varying vec3 vP; varying vec3 vWN; varying vec3 vView;
      void main(){
        vP = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWN = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`;

    /* ================= SPACE SCENE ================= */
    const space = new THREE.Scene();
    space.background = new THREE.Color(0x020309);

    // Europa: icy albedo, rust lineae ridges, chaos-terrain blotches, blue limb
    const europaMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: SUN } },
      vertexShader: PLANET_VERT,
      fragmentShader: NOISE + `
        uniform vec3 uSun; varying vec3 vP; varying vec3 vWN; varying vec3 vView;
        void main(){
          vec3 p = normalize(vP);
          float base = fbm(p*2.4);
          vec3 ice = mix(vec3(0.74,0.78,0.80), vec3(0.93,0.91,0.87), base*0.5+0.5);
          float r1 = 1.0-abs(snoise(p*2.6+vec3(1.7,0.2,3.1)));
          float r2 = 1.0-abs(snoise(p*5.8+vec3(4.1,2.2,0.3)));
          float r3 = 1.0-abs(snoise(p*13.0+vec3(7.3,1.1,5.5)));
          float lines = pow(r1,22.0)*0.95 + pow(r2,26.0)*0.7 + pow(r3,30.0)*0.45;
          float halo = pow(r1,6.0)*0.25;
          vec3 rust = vec3(0.56,0.31,0.19);
          vec3 col = mix(ice, mix(ice, rust, 0.45), halo);
          col = mix(col, rust, clamp(lines,0.0,1.0));
          float chaos = smoothstep(0.22,0.55, fbm(p*1.25+vec3(9.0,3.0,1.0)));
          col = mix(col, vec3(0.60,0.45,0.35)*(0.85+0.3*snoise(p*30.0)), chaos*0.55);
          vec3 n = normalize(vWN);
          float nd = dot(n, uSun);
          float diff = smoothstep(-0.08, 1.0, nd);
          float rim = pow(1.0-max(dot(n, normalize(vView)),0.0), 3.0);
          vec3 lit = col*(0.025 + diff*1.08) + vec3(0.55,0.78,0.95)*rim*0.45*smoothstep(-0.3,0.5,nd);
          gl_FragColor = vec4(lit, 1.0);
        }`,
    });
    const europa = new THREE.Mesh(new THREE.SphereGeometry(2, 160, 120), europaMat);
    europa.rotation.z = 0.08;
    space.add(europa);

    // Jupiter: turbulent banding, a great red spot, warm limb
    const jupiterMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: SUN }, uTime: { value: 0 } },
      vertexShader: PLANET_VERT,
      fragmentShader: NOISE + `
        uniform vec3 uSun; uniform float uTime; varying vec3 vP; varying vec3 vWN; varying vec3 vView;
        void main(){
          vec3 p = normalize(vP);
          float n = fbm(vec3(p.x*2.2, p.y*11.0, p.z*2.2) + vec3(uTime*0.01, 0.0, 0.0));
          float b = sin(p.y*24.0 + n*2.4);
          vec3 c1 = vec3(0.92,0.86,0.74), c2 = vec3(0.78,0.60,0.43), c3 = vec3(0.52,0.37,0.27);
          vec3 col = mix(c1, c2, smoothstep(-0.4,0.7,b));
          col = mix(col, c3, smoothstep(0.55,0.95, sin(p.y*9.0 + n*1.6))*0.55);
          col *= 0.92 + 0.12*snoise(vec3(p.x*6.0, p.y*40.0, p.z*6.0));
          vec3 spot = normalize(vec3(0.62,-0.36,0.70));
          vec3 q = p - spot; q.y *= 1.7;
          float grs = smoothstep(0.16, 0.05, length(q) + n*0.04);
          col = mix(col, vec3(0.74,0.36,0.22), grs*0.85);
          vec3 nn = normalize(vWN);
          float nd = dot(nn, uSun);
          float diff = smoothstep(-0.12, 1.0, nd);
          float rim = pow(1.0-max(dot(nn, normalize(vView)),0.0), 2.5);
          vec3 lit = col*(0.02 + diff*1.0) + vec3(0.95,0.78,0.55)*rim*0.25*smoothstep(-0.2,0.6,nd);
          gl_FragColor = vec4(lit, 1.0);
        }`,
    });
    const jupiter = new THREE.Mesh(new THREE.SphereGeometry(13, 128, 96), jupiterMat);
    jupiter.position.set(-18, 5.5, -44);
    jupiter.rotation.z = 0.05;
    space.add(jupiter);

    // Starfield: two layers, faint and bright
    function stars(count, size, opacity) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 600;
        const k = Math.sqrt(1 - u * u);
        pos.set([Math.cos(th) * k * r, u * r, Math.sin(th) * k * r], i * 3);
      }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8f5, size, sizeAttenuation: false, transparent: true, opacity, depthWrite: false }));
    }
    space.add(stars(5000, 1.1, 0.7), stars(500, 2.2, 0.95));

    /* ================= DEPTH SCENE ================= */
    const depth = new THREE.Scene();
    depth.background = new THREE.Color(0x9cc6d6);
    depth.fog = new THREE.Fog(0x9cc6d6, 1.5, 26);
    const hemi = new THREE.HemisphereLight(0xb5dcea, 0x0a1a26, 0.75);
    depth.add(hemi);
    const shaft = new THREE.DirectionalLight(0xdff4ff, 0.6); shaft.position.set(0.3, 1, 0.2); depth.add(shaft);

    const ICE_FLOOR = -82;            // ice/ocean interface in scene units
    const OCEAN_FLOOR = -135;

    // Ice shards: instanced, translucent, packed around the borehole
    const SHARDS = 650;
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xa9d6e6, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.45,
      flatShading: true, emissive: 0x1d4f63, emissiveIntensity: 0.2,
    });
    const shards = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), shardMat, SHARDS);
    {
      const d = new THREE.Object3D();
      for (let i = 0; i < SHARDS; i++) {
        const a = Math.random() * Math.PI * 2, r = 1.7 + Math.pow(Math.random(), 0.7) * 10;
        d.position.set(Math.cos(a) * r, 4 - Math.random() * (4 - ICE_FLOOR + 2), Math.sin(a) * r - 1.5);
        d.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        const s = 0.18 + Math.random() * 0.9;
        d.scale.set(s, s * (1.4 + Math.random() * 2.4), s);
        d.updateMatrix();
        shards.setMatrixAt(i, d.matrix);
      }
    }
    depth.add(shards);

    // Underside of the ice shell: a pale ceiling you pass through into the ocean
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x8fc3d4, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
    );
    ceiling.rotation.x = -Math.PI / 2; ceiling.position.y = ICE_FLOOR;
    depth.add(ceiling);

    // Cryobot: metal body, glowing heat bands, hot nose, tether, meltwater bubbles
    const probe = new THREE.Group();
    {
      const metal = new THREE.MeshStandardMaterial({ color: 0xc9d0d6, metalness: 0.55, roughness: 0.32 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 32), metal);
      probe.add(body);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 32), metal);
      cap.position.y = 0.61; probe.add(cap);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0xffb47c });
      [-0.3, 0.05, 0.35].forEach((y) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.163, 0.012, 8, 40), bandMat);
        band.rotation.x = Math.PI / 2; band.position.y = y; probe.add(band);
      });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 32), new THREE.MeshBasicMaterial({ color: 0xffd6a6 }));
      nose.rotation.x = Math.PI; nose.position.y = -0.72; probe.add(nose);
      const glow = new THREE.PointLight(0xffc28f, 2.4, 7, 1.6);
      glow.position.y = -0.9; probe.add(glow);
      const tg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.66, 0), new THREE.Vector3(0, 140, 0)]);
      probe.add(new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xe9f6fb, transparent: true, opacity: 0.55 })));
    }
    depth.add(probe);

    const BUB = 260;
    const bubPos = new Float32Array(BUB * 3), bubVel = new Float32Array(BUB);
    function resetBubble(i, anywhere) {
      const a = Math.random() * Math.PI * 2, r = 0.17 + Math.random() * 0.08;
      bubPos[i * 3] = Math.cos(a) * r;
      bubPos[i * 3 + 1] = anywhere ? -0.8 + Math.random() * 4.5 : -0.85 + Math.random() * 0.2;
      bubPos[i * 3 + 2] = Math.sin(a) * r;
      bubVel[i] = 0.4 + Math.random() * 0.9;
    }
    for (let i = 0; i < BUB; i++) resetBubble(i, true);
    const bubGeo = new THREE.BufferGeometry();
    bubGeo.setAttribute("position", new THREE.BufferAttribute(bubPos, 3));
    const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ color: 0xeaf8ff, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
    probe.add(bubbles);

    // Bioluminescence: GPU-animated points with twinkle and drift
    const BIO = reduce ? 1400 : 3200;
    const bioGeo = new THREE.BufferGeometry();
    {
      const pos = new Float32Array(BIO * 3), seed = new Float32Array(BIO), size = new Float32Array(BIO);
      for (let i = 0; i < BIO; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.8 + Math.pow(Math.random(), 0.6) * 16;
        pos.set([Math.cos(a) * r, ICE_FLOOR - 3 - Math.random() * (ICE_FLOOR - OCEAN_FLOOR + 20), Math.sin(a) * r - 2], i * 3);
        seed[i] = Math.random();
        size[i] = Math.random() < 0.06 ? 3.2 + Math.random() * 3 : 0.7 + Math.random() * 1.6;
      }
      bioGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      bioGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      bioGeo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    }
    const bioMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: DPR }, uFade: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed; attribute float aSize;
        uniform float uTime; uniform float uPR;
        varying float vA; varying float vSeed;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.21 + aSeed*31.0)*0.5;
          p.y += sin(uTime*0.13 + aSeed*17.0)*0.7;
          p.z += cos(uTime*0.17 + aSeed*23.0)*0.5;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5*sin(uTime*(0.5 + aSeed*1.8) + aSeed*60.0);
          vA = 0.35 + tw*0.65; vSeed = aSeed;
          gl_PointSize = aSize * uPR * (34.0 / -mv.z) * (0.7 + tw*0.5);
        }`,
      fragmentShader: `
        uniform float uFade; varying float vA; varying float vSeed;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d); a *= a;
          vec3 col = mix(vec3(0.38,0.96,0.86), vec3(0.50,0.58,1.0), step(0.84, vSeed));
          col = mix(col, vec3(1.0,0.62,0.85), step(0.97, vSeed));
          gl_FragColor = vec4(col, a * vA * uFade);
        }`,
    });
    depth.add(new THREE.Points(bioGeo, bioMat));

    /* ================= Post-processing ================= */
    let composer = null, renderPass = null, bloom = null;
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
      composer = new THREE.EffectComposer(renderer);
      renderPass = new THREE.RenderPass(space, camera);
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
      composer.addPass(renderPass);
      composer.addPass(bloom);
    }

    /* ================= Sizing ================= */
    let W = 1, H = 1, wide = false;
    function resize() {
      W = window.innerWidth; H = window.innerHeight; wide = W > 860;
      renderer.setSize(W, H, false);
      if (composer) { composer.setPixelRatio && composer.setPixelRatio(DPR); composer.setSize(W, H); }
      camera.aspect = W / H;
      camera.fov = wide ? 40 : 52;
      camera.updateProjectionMatrix();
    }
    resize();
    addEventListener("resize", resize);

    /* ================= Choreography ================= */
    // Space keyframes in story position s. o = how far the subject is pushed right of the text column.
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const KEYS = [
      { s: 0.0,  p: V(0.0, 0.35, 13.5), l: V(0, 0, 0),           o: 1.0 },
      { s: 1.0,  p: V(2.8, 0.9, 7.0),   l: V(0, 0, 0),           o: 1.0 },
      { s: 2.0,  p: V(4.6, 1.0, 7.8),   l: V(-6.5, 2.2, -15),    o: 0.95 },
      { s: 3.0,  p: V(0.45, 0.6, 3.1),  l: V(0, 0, 0),           o: 0.6 },
      { s: 3.72, p: V(0.03, 0.09, 2.05), l: V(0, -0.5, 1.5),     o: 0.0 },
    ];
    const DEPTH_KEYS = [[3.72, 0], [4.0, -7], [5.0, -40], [6.0, -84], [7.0, -118], [7.6, -128]];
    const SWITCH = 3.72;

    const camPos = V(0, 0, 0), camLook = V(0, 0, 0);
    function spaceCam(s) {
      let i = 0;
      while (i < KEYS.length - 2 && s > KEYS[i + 1].s) i++;
      const a = KEYS[i], b = KEYS[i + 1];
      const t = smooth(a.s, b.s, s);
      camPos.lerpVectors(a.p, b.p, t);
      camLook.lerpVectors(a.l, b.l, t);
      return lerp(a.o, b.o, t);
    }
    function depthY(s) {
      if (s <= DEPTH_KEYS[0][0]) return 0;
      for (let i = 0; i < DEPTH_KEYS.length - 1; i++) {
        const [s0, y0] = DEPTH_KEYS[i], [s1, y1] = DEPTH_KEYS[i + 1];
        if (s <= s1) return lerp(y0, y1, (s - s0) / (s1 - s0));
      }
      return DEPTH_KEYS[DEPTH_KEYS.length - 1][1];
    }
    // Water colour by depth: bright ice near the top, deepening blue, then black ocean
    const C_TOP = new THREE.Color(0x5d93a8), C_MID = new THREE.Color(0x225a72), C_LOW = new THREE.Color(0x0b2a3d), C_OCEAN = new THREE.Color(0x01060d);
    const tmpC = new THREE.Color();
    function waterColor(y) {
      if (y > -40) return tmpC.copy(C_TOP).lerp(C_MID, smooth(0, -40, y));
      if (y > ICE_FLOOR) return tmpC.copy(C_MID).lerp(C_LOW, smooth(-40, ICE_FLOOR, y));
      return tmpC.copy(C_LOW).lerp(C_OCEAN, smooth(ICE_FLOOR, ICE_FLOOR - 14, y));
    }

    // pointer parallax
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    addEventListener("pointermove", (e) => { ptr.tx = e.clientX / W - 0.5; ptr.ty = e.clientY / H - 0.5; }, { passive: true });

    const flash = $("#flash");
    let sSmooth = storyPos(), last = performance.now(), time = 0, firstFrame = true;

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (!reduce) time += dt;
      const sTarget = storyPos();
      sSmooth += (sTarget - sSmooth) * (reduce ? 1 : 0.12);
      const s = sSmooth;

      ptr.x += (ptr.tx - ptr.x) * 0.04; ptr.y += (ptr.ty - ptr.y) * 0.04;
      const par = reduce ? 0 : 1;
      let alt = 0, depthKm = 0;

      if (s < SWITCH) {
        const off = spaceCam(s);
        const near = smooth(2.6, 3.7, s);              // kill parallax near the surface
        camera.position.copy(camPos);
        camera.position.x += ptr.x * 0.35 * par * (1 - near);
        camera.position.y -= ptr.y * 0.25 * par * (1 - near);
        camera.lookAt(camLook);
        if (wide && off > 0.001) camera.setViewOffset(W, H, -W * 0.2 * off, 0, W, H);
        else camera.clearViewOffset();
        europa.rotation.y = 0.6 + s * 0.35 + time * 0.012;
        jupiter.rotation.y = time * 0.01;
        jupiterMat.uniforms.uTime.value = time;
        alt = (camera.position.length() - 2) * 780;     // Europa radius 1,561 km = 2 units
        if (renderPass) renderPass.scene = space;
        if (bloom) { bloom.strength = 0.5; bloom.threshold = 0.8; bloom.radius = 0.55; }
        current = space;
      } else {
        if (wide) camera.setViewOffset(W, H, -W * 0.2, 0, W, H); else camera.clearViewOffset();
        const y = depthY(s);
        const sway = reduce ? 0 : Math.sin(time * 0.35) * 0.25;
        probe.position.set(Math.sin(time * 0.7) * 0.04 * par, y - 1.45, 0);
        probe.rotation.z = Math.sin(time * 0.5) * 0.03 * par;
        camera.position.set(0.9 + sway + ptr.x * 0.6 * par, y + 1.1 - ptr.y * 0.3 * par, 3.2);
        camera.lookAt(0, y - 1.9, 0);
        const wc = waterColor(y);
        depth.background.copy(wc); depth.fog.color.copy(wc);
        const inOcean = smooth(ICE_FLOOR + 4, ICE_FLOOR - 8, y);
        depth.fog.near = lerp(1.5, 2.5, inOcean); depth.fog.far = lerp(24, 20, inOcean);
        hemi.intensity = lerp(0.75, 0.1, smooth(0, ICE_FLOOR, y));
        shaft.intensity = lerp(0.4, 0.0, smooth(-10, -60, y));
        shardMat.opacity = lerp(0.45, 0.0, inOcean);
        bioMat.uniforms.uFade.value = inOcean;
        bioMat.uniforms.uTime.value = time;
        // meltwater bubbles rise along the body
        if (!reduce) {
          for (let i = 0; i < BUB; i++) {
            bubPos[i * 3 + 1] += bubVel[i] * dt;
            bubPos[i * 3] *= 1 + dt * 0.08;
            bubPos[i * 3 + 2] *= 1 + dt * 0.08;
            if (bubPos[i * 3 + 1] > 3.8) resetBubble(i, false);
          }
          bubGeo.attributes.position.needsUpdate = true;
        }
        const yProbe = -y;
        depthKm = yProbe <= -ICE_FLOOR ? (yProbe / -ICE_FLOOR) * 20 : 20 + ((yProbe + ICE_FLOOR) / (OCEAN_FLOOR - ICE_FLOOR)) * -60;
        depthKm = Math.max(0, depthKm);
        if (renderPass) renderPass.scene = depth;
        if (bloom) { bloom.strength = lerp(0.55, 1.25, inOcean); bloom.threshold = lerp(0.88, 0.15, inOcean); bloom.radius = 0.7; }
        current = depth;
      }

      // white-out as the probe breaks through the surface: hides the scene swap
      flash.style.opacity = String(clamp(1 - Math.abs(s - SWITCH) / 0.16, 0, 1) * 0.95);

      if (composer) composer.render(); else renderer.render(current, camera);
      updateHud(s, alt, depthKm, now);

      if (firstFrame) { firstFrame = false; setTimeout(hideLoader, 350); }
      requestAnimationFrame(frame);
    }
    let current = space;
    requestAnimationFrame(frame);
  }
})();
