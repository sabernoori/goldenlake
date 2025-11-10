

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

  // ============== Helpers ==============
  const asNumber = (v, d) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  };
  const asBoolean = (v, d = false) => {
    if (v == null) return d;
    const s = String(v).toLowerCase().trim();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  };
  const asColorLinear = (hexOrCss, fallbackHex = '#ffffff') => {
    let c;
    try { c = new THREE.Color(hexOrCss || fallbackHex); }
    catch { c = new THREE.Color(fallbackHex); }
    c.convertSRGBToLinear();
    return [c.r, c.g, c.b];
  };
  const getShader = (id) => document.getElementById(id).textContent;

  // ============== Root & attributes ==============
  const componentEl = document.querySelector('[fc-fluid-gradient="component"]') || document.body;

  const guiEnabled = asBoolean(componentEl.getAttribute('fc-fluid-gradient-gui'), false);
  const guiPosAttr = componentEl.getAttribute('fc-fluid-gradient-gui-position') || 'top-right';
  const guiTitle   = componentEl.getAttribute('fc-fluid-gradient-gui-title') || 'Fluid Controls';

  const defaults = {
    brushSize:        25.0,
    brushStrength:    0.3,
    distortionAmount: 1.5,
    fluidDecay:       0.99,
    trailLength:      0.85,
    stopDecay:        0.85,
    color1:           '#3d0000',
    color2:           '#900000',
    color3:           '#ff0000',
    color4:           '#1a0000',
    colorIntensity:   1.0,
    softness:         2.0,
    dprMax:           2.0,
    softResetFrames:  12,
    softResetStrength:0.15,
    flowSpeed:        0.5,
    idleSpeed: 				1.0,
  };
  const attr = (name) => componentEl.getAttribute(name);

  const config = {
    brushSize:        asNumber(attr('fc-fluid-gradient-brush-size'),        defaults.brushSize),
    brushStrength:    asNumber(attr('fc-fluid-gradient-brush-strength'),    defaults.brushStrength),
    distortionAmount: asNumber(attr('fc-fluid-gradient-distortion-amount'), defaults.distortionAmount),
    fluidDecay:       asNumber(attr('fc-fluid-gradient-fluid-decay'),       defaults.fluidDecay),
    trailLength:      asNumber(attr('fc-fluid-gradient-trail-length'),      defaults.trailLength),
    stopDecay:        asNumber(attr('fc-fluid-gradient-stop-decay'),        defaults.stopDecay),
    color1:           attr('fc-fluid-gradient-color-1') || defaults.color1,
    color2:           attr('fc-fluid-gradient-color-2') || defaults.color2,
    color3:           attr('fc-fluid-gradient-color-3') || defaults.color3,
    color4:           attr('fc-fluid-gradient-color-4') || defaults.color4,
    colorIntensity:   asNumber(attr('fc-fluid-gradient-color-intensity'),   defaults.colorIntensity),
    softness:         asNumber(attr('fc-fluid-gradient-softness'),          defaults.softness),
    dprMax:           asNumber(attr('fc-fluid-gradient-dpr-max'),           defaults.dprMax),
    softResetFrames:  asNumber(attr('fc-fluid-gradient-soft-reset-frames'), defaults.softResetFrames),
    softResetStrength:asNumber(attr('fc-fluid-gradient-soft-reset-strength'),defaults.softResetStrength),
    flowSpeed:        asNumber(attr('fc-fluid-gradient-flow-speed'),        defaults.flowSpeed),
    idleSpeed: 				asNumber(attr('fc-fluid-gradient-idle-speed'), defaults.idleSpeed),
  };

  const hoverEnabled = asBoolean(attr('fc-fluid-gradient-hover'), true);

  // ============== Shaders ==============
  const vertexShader  = getShader('vs-fluid');
  const fluidShader   = getShader('fs-fluid');
  const displayShader = getShader('fs-display');

  // ============== Renderer / Camera ==============
  const gradientCanvas = componentEl;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  if (!renderer.capabilities.isWebGL2) {
    console.error('This demo requires WebGL 2. Please update your browser.');
  }
  // Colori fedeli: niente tone mapping, solo conversione sRGB in shader
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;    // <-- niente ACES, niente exposure
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.dprMax));
  gradientCanvas.appendChild(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function getCanvasSize() {
    const r = gradientCanvas.getBoundingClientRect();
    return { width: Math.max(1, r.width), height: Math.max(1, r.height) };
  }

  // ============== Render targets ==============
  const rtOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const fluidTarget1 = new THREE.WebGLRenderTarget(1, 1, rtOptions);
  const fluidTarget2 = fluidTarget1.clone();
  let currentFluidTarget = fluidTarget1;
  let previousFluidTarget = fluidTarget2;

  // ============== Materials ==============
  const color1Linear = asColorLinear(config.color1);
  const color2Linear = asColorLinear(config.color2);
  const color3Linear = asColorLinear(config.color3);
  const color4Linear = asColorLinear(config.color4);

  const fluidMaterial = new THREE.ShaderMaterial({
    uniforms: {
      iTime:          { value: 0 },
      iResolution:    { value: new THREE.Vector2(1, 1) },
      iMouse:         { value: new THREE.Vector4(0, 0, 0, 0) },
      iFrame:         { value: 0 },
      iPreviousFrame: { value: null },
      uBrushSize:     { value: config.brushSize },
      uBrushStrength: { value: config.brushStrength },
      uFluidDecay:    { value: config.fluidDecay },
      uTrailLength:   { value: config.trailLength },
      uStopDecay:     { value: config.stopDecay },
      uSoftReset:     { value: 0.0 },
      uFlowSpeed:     { value: config.flowSpeed }, // <-- nuovo
    },
    vertexShader,
    fragmentShader: fluidShader,
  });

  const displayMaterial = new THREE.ShaderMaterial({
    uniforms: {
      iTime:             { value: 0 },
      iResolution:       { value: new THREE.Vector2(1, 1) },
      iFluid:            { value: null },
      uDistortionAmount: { value: config.distortionAmount },
      uColor1:           { value: new THREE.Vector3(...color1Linear) },
      uColor2:           { value: new THREE.Vector3(...color2Linear) },
      uColor3:           { value: new THREE.Vector3(...color3Linear) },
      uColor4:           { value: new THREE.Vector3(...color4Linear) },
      uColorIntensity:   { value: config.colorIntensity },
      uSoftness:         { value: config.softness },
      uIdleSpeed:        { value: config.idleSpeed }, 
    },
    vertexShader,
    fragmentShader: displayShader,
    toneMapped: false, // lasciamo OFF: niente exposure
  });

  // ============== GUI (senza exposure, né slow morph) ==============
  if (guiEnabled) {
    const { default: GUI } = await import('https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm');
    const gui = new GUI({ title: guiTitle });

    const el = gui.domElement;
    el.style.zIndex = '9999';
    el.style.top = el.style.right = el.style.bottom = el.style.left = 'auto';
    switch (guiPosAttr) {
      case 'top-left':     el.style.top = '12px'; el.style.left  = '12px'; break;
      case 'bottom-right': el.style.bottom = '12px'; el.style.right = '12px'; break;
      case 'bottom-left':  el.style.bottom = '12px'; el.style.left  = '12px'; break;
      default:             el.style.top = '12px'; el.style.right = '12px'; break;
    }

    const gBrush = gui.addFolder('Brush');
    gBrush.add(config, 'brushSize', 1, 200, 1).onChange(v => {
      fluidMaterial.uniforms.uBrushSize.value = v;
    });
    gBrush.add(config, 'brushStrength', 0.05, 3, 0.01).onChange(v => {
      fluidMaterial.uniforms.uBrushStrength.value = v;
    });

    const gFluid = gui.addFolder('Fluid');
    gFluid.add(config, 'fluidDecay', 0.90, 0.999, 0.001).onChange(v => {
      fluidMaterial.uniforms.uFluidDecay.value = v;
    });
    gFluid.add(config, 'trailLength', 0.5, 0.999, 0.001).onChange(v => {
      fluidMaterial.uniforms.uTrailLength.value = v;
    });
    gFluid.add(config, 'stopDecay', 0.5, 1.0, 0.01).onChange(v => {
      fluidMaterial.uniforms.uStopDecay.value = v;
    });
    gFluid.add(config, 'flowSpeed', 0, 1.8, 0.02).name('Flow Speed')
      .onChange(v => { fluidMaterial.uniforms.uFlowSpeed.value = v; });

    const gDisp = gui.addFolder('Display');
    gDisp.add(config, 'distortionAmount', 0.0, 5.0, 0.05).onChange(v => {
      displayMaterial.uniforms.uDistortionAmount.value = v;
    });
    gDisp.add(config, 'colorIntensity', 0.2, 3.0, 0.01).onChange(v => {
      displayMaterial.uniforms.uColorIntensity.value = v;
    });
    gDisp.add(config, 'softness', 0.0, 5.0, 0.05).onChange(v => {
      displayMaterial.uniforms.uSoftness.value = v;
    });
    gDisp.add(config, 'idleSpeed', 0.0, 3.0, 0.05).name('Idle Speed')
      .onChange(v => displayMaterial.uniforms.uIdleSpeed.value = v);

    const setColorUniform = (u, hex) => {
      const c = new THREE.Color(hex).convertSRGBToLinear();
      u.value.set(c.r, c.g, c.b);
    };
    gDisp.addColor(config, 'color1').onChange(v => setColorUniform(displayMaterial.uniforms.uColor1, v));
    gDisp.addColor(config, 'color2').onChange(v => setColorUniform(displayMaterial.uniforms.uColor2, v));
    gDisp.addColor(config, 'color3').onChange(v => setColorUniform(displayMaterial.uniforms.uColor3, v));
    gDisp.addColor(config, 'color4').onChange(v => setColorUniform(displayMaterial.uniforms.uColor4, v));
  }

  // ============== Sizing ==============
  function setRendererSize({ resetFluid = false } = {}) {
    const { width, height } = getCanvasSize();
    renderer.setSize(width, height);
    fluidMaterial.uniforms.iResolution.value.set(width, height);
    displayMaterial.uniforms.iResolution.value.set(width, height);
    fluidTarget1.setSize(width, height);
    fluidTarget2.setSize(width, height);
    if (resetFluid) requestSoftReset(config.softResetFrames, config.softResetStrength);
  }
  setRendererSize();

  // ============== Scene quad ==============
  const geometry = new THREE.PlaneGeometry(2, 2);
  const fluidPlane   = new THREE.Mesh(geometry, fluidMaterial);
  const displayPlane = new THREE.Mesh(geometry, displayMaterial);

  // ============== Pointer input (desktop hover) ==============
  const isFinePointer = window.matchMedia && matchMedia('(pointer:fine)').matches;
  let mouseX = 0, mouseY = 0, prevMouseX = 0, prevMouseY = 0;
  let lastMoveTime = 0;

  function updateMouseUniform(x, y) {
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    mouseX = x; mouseY = y;
    lastMoveTime = performance.now();
    fluidMaterial.uniforms.iMouse.value.set(mouseX, mouseY, prevMouseX, prevMouseY);
  }

  if (isFinePointer && hoverEnabled) {
    gradientCanvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = gradientCanvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = r.height - (e.clientY - r.top);
      const dx = x - mouseX, dy = y - mouseY;
      const speed = Math.hypot(dx, dy);
      const speedFactor = Math.min(1.2, Math.max(0.8, 0.8 + speed * 0.003));
      fluidMaterial.uniforms.uBrushStrength.value = config.brushStrength;
      fluidMaterial.uniforms.uBrushSize.value = config.brushSize * speedFactor;
      updateMouseUniform(x, y);
    });
    gradientCanvas.addEventListener('pointerleave', () => {
      fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0);
      fluidMaterial.uniforms.uBrushStrength.value = config.brushStrength;
      fluidMaterial.uniforms.uBrushSize.value = config.brushSize;
    });
  }

  // ============== Soft reset ==============
  let softResetFramesLeft = 0;
  function requestSoftReset(frames = 12, perFrameAttenuation = 0.15) {
    softResetFramesLeft = frames;
    fluidMaterial.uniforms.uSoftReset.value = perFrameAttenuation;
  }

  // ============== CTA → colorIntensity ==============
  if (typeof window.gsap === "undefined") {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js";
    document.head.appendChild(script);

    script.onload = () => {
      console.log("GSAP loaded dynamically");
    };
  } else {
    console.log("GSAP already loaded!");
  }
  
  const ctaBtn = document.querySelector('[fc-fluid-gradient-cta]');
  if (ctaBtn) {
    const factor = asNumber(ctaBtn.getAttribute('fc-fluid-gradient-cta'), 1.15);
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const mul = clamp(factor, 0.1, 3.0);
    const baseIntensity = config.colorIntensity;

    ctaBtn.addEventListener('mouseenter', () => {
      gsap.to(displayMaterial.uniforms.uColorIntensity, { 
        value: baseIntensity * mul, 
        duration: parseFloat(ctaBtn.getAttribute('fc-fluid-gradient-transition-duration')), 
        ease: ctaBtn.getAttribute('fc-fluid-gradient-transition-easing')
      })
    });

    ctaBtn.addEventListener('mouseleave', () => {
      gsap.to(displayMaterial.uniforms.uColorIntensity, { 
        value: baseIntensity, 
        duration: parseFloat(ctaBtn.getAttribute('fc-fluid-gradient-transition-duration')), 
        ease: ctaBtn.getAttribute('fc-fluid-gradient-transition-easing')
      })    
    });

    ctaBtn.addEventListener('focus',  () => {
      gsap.to(displayMaterial.uniforms.uColorIntensity, { 
        value: baseIntensity * mul, 
        duration: parseFloat(ctaBtn.getAttribute('fc-fluid-gradient-transition-duration')), 
        ease: ctaBtn.getAttribute('fc-fluid-gradient-transition-easing')
      })
    });

    ctaBtn.addEventListener('blur',   () => {
      gsap.to(displayMaterial.uniforms.uColorIntensity, { 
        value: baseIntensity, 
        duration: parseFloat(ctaBtn.getAttribute('fc-fluid-gradient-transition-duration')), 
        ease: ctaBtn.getAttribute('fc-fluid-gradient-transition-easing')
      })    
    });
  }

  // ============== Main loop ==============
  let frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.001;

    fluidMaterial.uniforms.iTime.value = time;
    displayMaterial.uniforms.iTime.value = time;
    fluidMaterial.uniforms.iFrame.value = frameCount;

    if (performance.now() - lastMoveTime > 120) {
      fluidMaterial.uniforms.iMouse.value.set(0, 0, 0, 0);
    }

    // Sim pass
    fluidMaterial.uniforms.iPreviousFrame.value = previousFluidTarget.texture;
    renderer.setRenderTarget(currentFluidTarget);
    renderer.render(fluidPlane, camera);

    if (softResetFramesLeft > 0) {
      softResetFramesLeft--;
      if (softResetFramesLeft === 0) fluidMaterial.uniforms.uSoftReset.value = 0.0;
    }

    // Display pass
    displayMaterial.uniforms.iFluid.value = currentFluidTarget.texture;
    renderer.setRenderTarget(null);
    renderer.render(displayPlane, camera);

    [currentFluidTarget, previousFluidTarget] = [previousFluidTarget, currentFluidTarget];
    frameCount++;
  }

  // ============== Resize ==============
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => setRendererSize({ resetFluid: false }));
  });

  animate();
