  scene3d(THREE, canvas, opts) {
    opts = opts || {};
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const disposables = [];
    const keep = (x) => { disposables.push(x); return x; };

    /* studio environment for reflections: a dim teal room with two soft boxes */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x0f2f2b, side: THREE.BackSide }));
    envScene.add(room);
    const panel = (w, h, rgb, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      m.material.color.setRGB(rgb[0], rgb[1], rgb[2]);
      m.position.set(pos[0], pos[1], pos[2]);
      m.rotation.set(rot[0], rot[1], rot[2]);
      envScene.add(m);
    };
    panel(10, 6, [2.2, 2.05, 1.8], [-4, 5.9, 3], [Math.PI / 2, 0, 0]);
    panel(6, 4, [0.35, 1.1, 0.95], [11.9, 3, -4], [0, -Math.PI / 2, 0]);
    panel(5, 3, [1.4, 1.1, 0.6], [-11.9, 2, 5], [0, Math.PI / 2, 0]);
    const envTex = pmrem.fromScene(envScene, 0.035).texture;
    scene.environment = envTex;
    envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });

    scene.add(new THREE.HemisphereLight(0xd9efe9, 0x0d3a35, 0.25));
    const key = new THREE.DirectionalLight(0xffe6bd, 2.1);
    key.position.set(-5, 11, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x86e0cf, 0.8);
    rim.position.set(7, 4, -8);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);
    const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(60, 60)), keep(new THREE.ShadowMaterial({ opacity: 0.34 })));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.64; floor.receiveShadow = true;
    scene.add(floor);

    const phys = (c, r, o) => keep(new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: r, envMapIntensity: 0.8 }, o || {})));
    const rrect = (w, h, r) => {
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };
    const flatExtrude = (shape, depth, bevel, segs) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs || 3, curveSegments: 12 });
      g.rotateX(-Math.PI / 2);
      return keep(g);
    };

    /* board: plinth, lacquered frame with a gold inlay, bevelled squares */
    const plinth = new THREE.Mesh(flatExtrude(rrect(10.3, 10.3, 0.3), 0.1, 0.03), phys(0x041613, 0.7, { envMapIntensity: 0.3 }));
    plinth.position.y = -0.6; plinth.receiveShadow = true; plinth.castShadow = true; root.add(plinth);
    const frameShape = rrect(9.9, 9.9, 0.22);
    frameShape.holes.push(rrect(8.2, 8.2, 0.02));
    const frame = new THREE.Mesh(flatExtrude(frameShape, 0.5, 0.06, 4), phys(0x0b3a33, 0.34, { clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.55 }));
    frame.position.y = -0.48; frame.castShadow = true; frame.receiveShadow = true; root.add(frame);
    const bed = new THREE.Mesh(keep(new THREE.BoxGeometry(8.24, 0.5, 8.24)), phys(0x041a17, 0.8));
    bed.position.y = -0.26; bed.receiveShadow = true; root.add(bed);
    const inlayShape = rrect(8.72, 8.72, 0.06);
    inlayShape.holes.push(rrect(8.56, 8.56, 0.04));
    const inlay = new THREE.Mesh(flatExtrude(inlayShape, 0.012, 0), phys(0xd6b04f, 0.28, { metalness: 0.85 }));
    inlay.position.y = 0.082; root.add(inlay);
    const mats = {
      l: phys(0xe2dfc2, 0.6, { clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.4 }), d: phys(0x2f6e5e, 0.55, { clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.4 }),
      hl: phys(0xf0e67a, 0.5, { clearcoat: 0.15, envMapIntensity: 0.4 }), hd: phys(0xa8b94e, 0.5, { clearcoat: 0.15, envMapIntensity: 0.4 })
    };
    const sqGeo = flatExtrude(rrect(0.96, 0.96, 0.03), 0.05, 0.018, 2);
    const squares = {};
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const dark = (f + r) % 2 === 0;
        const m = new THREE.Mesh(sqGeo, dark ? mats.d : mats.l);
        m.position.set(f - 3.5, 0.0, 3.5 - r);
        m.receiveShadow = true;
        m.userData.dark = dark;
        root.add(m);
        squares['abcdefgh'[f] + (r + 1)] = m;
      }
    }
    const labelTex = (txt) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#b8d3ce'; g.font = '700 40px Archivo, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34);
      const t = keep(new THREE.CanvasTexture(c)); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
    };
    const labelGeo = keep(new THREE.PlaneGeometry(0.32, 0.32));
    for (let i = 0; i < 8; i++) {
      const fm = new THREE.Mesh(labelGeo, keep(new THREE.MeshBasicMaterial({ map: labelTex('abcdefgh'[i]), transparent: true })));
      fm.rotation.x = -Math.PI / 2; fm.position.set(i - 3.5, 0.09, 4.58); root.add(fm);
      const rm = new THREE.Mesh(labelGeo, keep(new THREE.MeshBasicMaterial({ map: labelTex(String(i + 1)), transparent: true })));
      rm.rotation.x = -Math.PI / 2; rm.position.set(-4.58, 0.09, 3.5 - i); root.add(rm);
    }

    /* pieces: turned profiles with collars, crowns and a sculpted knight */
    const V = (pts) => pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const ball = (cy, r, from) => { const out = []; for (let a = from; a <= 90; a += 10) out.push([r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]); return out; };
    const base = [[0, 0], [0.35, 0], [0.36, 0.015], [0.36, 0.06], [0.34, 0.085], [0.3, 0.1], [0.3, 0.125], [0.27, 0.15], [0.24, 0.175], [0.21, 0.2]];
    const profiles = {
      p: base.concat([[0.17, 0.24], [0.13, 0.32], [0.11, 0.4], [0.18, 0.43], [0.19, 0.455], [0.17, 0.475], [0.1, 0.49]]).concat(ball(0.6, 0.14, -50)),
      r: base.concat([[0.2, 0.28], [0.19, 0.5], [0.2, 0.56], [0.25, 0.6], [0.27, 0.63], [0.27, 0.66], [0.25, 0.68], [0.27, 0.7], [0.27, 0.8], [0.19, 0.8], [0.19, 0.74], [0, 0.74]]),
      b: base.concat([[0.16, 0.3], [0.12, 0.46], [0.1, 0.58], [0.2, 0.62], [0.21, 0.645], [0.19, 0.665], [0.11, 0.68], [0.14, 0.74], [0.18, 0.84], [0.175, 0.93], [0.14, 1.0], [0.08, 1.06], [0.04, 1.09]]).concat(ball(1.135, 0.05, -40)),
      q: base.concat([[0.17, 0.3], [0.13, 0.5], [0.11, 0.7], [0.23, 0.74], [0.24, 0.765], [0.22, 0.785], [0.12, 0.8], [0.14, 0.9], [0.2, 1.0], [0.25, 1.05], [0.25, 1.085], [0.19, 1.08], [0.1, 1.1], [0.06, 1.14]]).concat(ball(1.19, 0.06, -40)),
      k: base.concat([[0.17, 0.32], [0.13, 0.55], [0.11, 0.74], [0.24, 0.78], [0.25, 0.805], [0.23, 0.825], [0.12, 0.84], [0.15, 0.96], [0.21, 1.08], [0.23, 1.11], [0.23, 1.14], [0.16, 1.15], [0.08, 1.17], [0, 1.175]]),
      n: base.concat([[0.23, 0.22], [0.25, 0.24], [0.25, 0.28], [0, 0.28]])
    };
    const geos = {};
    Object.keys(profiles).forEach((k) => { geos[k] = keep(new THREE.LatheGeometry(V(profiles[k]), 48)); });
    const head = new THREE.Shape();
    head.moveTo(-0.2, 0.26); head.lineTo(0.15, 0.26);
    head.quadraticCurveTo(0.11, 0.42, 0.24, 0.5);
    head.quadraticCurveTo(0.38, 0.56, 0.42, 0.62);
    head.quadraticCurveTo(0.46, 0.68, 0.4, 0.73);
    head.quadraticCurveTo(0.3, 0.77, 0.2, 0.78);
    head.quadraticCurveTo(0.16, 0.9, 0.09, 0.97);
    head.lineTo(0.07, 1.06); head.lineTo(0.0, 1.0);
    head.quadraticCurveTo(-0.16, 0.93, -0.22, 0.74);
    head.quadraticCurveTo(-0.29, 0.5, -0.2, 0.26);
    const headGeo = keep(new THREE.ExtrudeGeometry(head, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 5, curveSegments: 18 }));
    headGeo.translate(0, 0, -0.1);
    const maneShape = new THREE.Shape();
    maneShape.moveTo(-0.02, 0.98); maneShape.quadraticCurveTo(-0.2, 0.92, -0.26, 0.7); maneShape.quadraticCurveTo(-0.3, 0.5, -0.24, 0.3);
    maneShape.lineTo(-0.2, 0.3); maneShape.quadraticCurveTo(-0.25, 0.52, -0.2, 0.72); maneShape.quadraticCurveTo(-0.14, 0.88, 0.0, 0.95);
    const maneGeo = keep(new THREE.ExtrudeGeometry(maneShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 14 }));
    maneGeo.translate(-0.01, 0, -0.05);
    const eyeGeo = keep(new THREE.SphereGeometry(0.024, 12, 8));
    const crossShape = new THREE.Shape();
    [[-0.035, 0], [0.035, 0], [0.035, 0.11], [0.1, 0.11], [0.1, 0.165], [0.035, 0.165], [0.035, 0.26], [-0.035, 0.26], [-0.035, 0.165], [-0.1, 0.165], [-0.1, 0.11], [-0.035, 0.11]].forEach((p, i) => (i ? crossShape.lineTo(p[0], p[1]) : crossShape.moveTo(p[0], p[1])));
    const crossGeo = keep(new THREE.ExtrudeGeometry(crossShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 }));
    crossGeo.translate(0, 1.16, -0.025);
    const merlonGeo = keep(new THREE.BoxGeometry(0.12, 0.1, 0.1));
    const pearlGeo = keep(new THREE.SphereGeometry(0.036, 12, 8));
    const slitGeo = keep(new THREE.BoxGeometry(0.03, 0.2, 0.3));
    const feltGeo = keep(new THREE.CylinderGeometry(0.335, 0.335, 0.012, 40));
    const pMat = {
      w: phys(0xe9e2d2, 0.34, { clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.7 }),
      b: phys(0x1a201f, 0.22, { metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.12 })
    };
    const darkMat = phys(0x0a0d0c, 0.5);
    const feltMat = phys(0x0f3a33, 1);
    const makePiece = (ch) => {
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const t = ch.toLowerCase();
      const g = new THREE.Group();
      const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat || pMat[color]); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
      add(geos[t]);
      const felt = add(feltGeo, feltMat); felt.position.y = -0.004; felt.castShadow = false;
      if (t === 'n') {
        const face = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
        const h = add(headGeo); h.rotation.y = face;
        const mane = add(maneGeo); mane.rotation.y = face;
        [-1, 1].forEach((sd) => {
          const e = add(eyeGeo, darkMat);
          const lx = 0.2, lz = sd * 0.15;
          e.position.set(Math.cos(face) * lx + Math.sin(face) * lz, 0.8, -Math.sin(face) * lx + Math.cos(face) * lz);
        });
      }
      if (t === 'k') { add(crossGeo); }
      if (t === 'r') {
        for (let i = 0; i < 6; i++) { const m = add(merlonGeo); const a = (i / 6) * Math.PI * 2; m.position.set(Math.cos(a) * 0.23, 0.85, Math.sin(a) * 0.23); m.rotation.y = -a; }
      }
      if (t === 'q') {
        for (let i = 0; i < 9; i++) { const m = add(pearlGeo); const a = (i / 9) * Math.PI * 2; m.position.set(Math.cos(a) * 0.235, 1.1, Math.sin(a) * 0.235); }
      }
      if (t === 'b') { const s = add(slitGeo, darkMat); s.position.set(0.09, 0.92, 0); s.rotation.z = -0.6; s.scale.set(1, 0.9, 0.55); s.castShadow = false; }
      g.scale.setScalar(0.86);
      g.userData = { type: ch };
      return g;
    };
    const sqPos = (sq) => new THREE.Vector3('abcdefgh'.indexOf(sq[0]) - 3.5, 0.075, 3.5 - (Number(sq[1]) - 1));
    const parse = (fen) => {
      const map = {};
      fen.split('/').forEach((row, ri) => {
        let fi = 0;
        for (const ch of row) {
          const n = Number(ch);
          if (n) { fi += n; continue; }
          map['abcdefgh'[fi] + (8 - ri)] = ch; fi++;
        }
      });
      return map;
    };
    const pieces = {};
    const tweens = [];
    const removeMesh = (m) => { root.remove(m); };
    const removePiece = (sq) => { const m = pieces[sq]; if (m) { removeMesh(m); delete pieces[sq]; } };
    const place = (sq, ch) => { const m = makePiece(ch); m.position.copy(sqPos(sq)); root.add(m); pieces[sq] = m; return m; };
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = (mesh, from, to, dur) => { if (reduce) { mesh.position.copy(to); return; } tweens.push({ mesh, from: from.clone(), to: to.clone(), t0: performance.now(), dur }); };
    const highlight = (a, b) => {
      Object.keys(squares).forEach((k) => { const s = squares[k]; s.material = (k === a || k === b) ? (s.userData.dark ? mats.hd : mats.hl) : (s.userData.dark ? mats.d : mats.l); });
    };

    /* captured pieces wait beside the board */
    let tray = [];
    const layTray = (next) => {
      tray.forEach(removeMesh); tray = [];
      const start = { q: 1, r: 2, b: 2, n: 2, p: 8 };
      const cnt = {};
      Object.keys(next).forEach((k) => { cnt[next[k]] = (cnt[next[k]] || 0) + 1; });
      if (opts.tray === false) return;
      [['w', -3.4], ['b', 3.4]].forEach(([col, z0]) => {
        let i = 0;
        ['q', 'r', 'b', 'n', 'p'].forEach((t) => {
          const ch = col === 'w' ? t.toUpperCase() : t;
          const miss = Math.max(0, start[t] - (cnt[ch] || 0));
          for (let k = 0; k < miss; k++) {
            const m = makePiece(ch);
            m.scale.setScalar(0.6);
            const row = Math.floor(i / 2), c2 = i % 2;
            m.position.set(-5.55 - c2 * 0.52, -0.63, z0 + (z0 < 0 ? 1 : -1) * row * 0.6);
            root.add(m); tray.push(m); i++;
          }
        });
      });
    };
    const setPosition = (fen, uci, animate) => {
      const next = parse(fen);
      const from = uci ? uci.slice(0, 2) : '', to = uci ? uci.slice(2, 4) : '';
      if (animate && from && pieces[from]) {
        const mover = pieces[from];
        delete pieces[from];
        removePiece(to);
        pieces[to] = mover;
        tween(mover, mover.position, sqPos(to), 650);
      }
      const gone = [], fresh = [];
      Object.keys(pieces).forEach((sq) => { if (!next[sq] || next[sq] !== pieces[sq].userData.type) gone.push(sq); });
      Object.keys(next).forEach((sq) => { if (!pieces[sq] || pieces[sq].userData.type !== next[sq]) fresh.push(sq); });
      const pairs = [];
      gone.slice().forEach((g) => {
        const ty = pieces[g] && pieces[g].userData.type;
        const i = fresh.findIndex((f) => next[f] === ty && !pieces[f]);
        if (animate && ty && i >= 0) { pairs.push([g, fresh[i]]); fresh.splice(i, 1); gone.splice(gone.indexOf(g), 1); }
      });
      pairs.forEach(([g, f]) => { const m = pieces[g]; delete pieces[g]; pieces[f] = m; tween(m, m.position, sqPos(f), 650); });
      gone.forEach(removePiece);
      fresh.forEach((sq) => { removePiece(sq); place(sq, next[sq]); });
      highlight(from, to);
      layTray(next);
    };

    /* orbit: drag to rotate, arrow keys, double click to reset, pinch or ctrl+wheel to zoom */
    const baseAng = opts.angle != null ? opts.angle : -0.62;
    const baseElev = opts.elev != null ? opts.elev : 0.62;
    let ang = baseAng, elev = baseElev, zoom = 1, vel = 0, dragging = false, touched = false, lastX = 0, lastY = 0, resetT = 0;
    const clampElev = (e) => Math.max(0.22, Math.min(1.35, e));
    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true; touched = true; lastX = e.clientX; lastY = e.clientY; vel = 0; resetT = 0;
      if (canvas.setPointerCapture && e.pointerId != null) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      ang -= dx * 0.008; vel = -dx * 0.008;
      if (e.pointerType !== 'touch') elev = clampElev(elev + dy * 0.006);
    };
    const onUp = () => { dragging = false; canvas.style.cursor = 'grab'; };
    const onDbl = () => { resetT = performance.now(); vel = 0; };
    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') ang += 0.18; else if (k === 'ArrowRight') ang -= 0.18;
      else if (k === 'ArrowUp') elev = clampElev(elev + 0.1); else if (k === 'ArrowDown') elev = clampElev(elev - 0.1);
      else if (k === 'Home' || k === '0') resetT = performance.now();
      else return;
      touched = true; e.preventDefault();
    };
    const onWheel = (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom = Math.max(0.7, Math.min(1.45, zoom * (1 + e.deltaY * 0.004))); touched = true; };
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('dblclick', onDbl);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let w = 0, h = 0, raf = 0, alive = true;
    const t0 = performance.now();
    const resize = () => {
      const parent = canvas.parentElement;
      const nw = Math.max(1, parent.clientWidth), nh = Math.max(1, parent.clientHeight);
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const off = (w / h >= 1.3 ? (opts.offset || [0, 0]) : (opts.offsetNarrow || [0, 0]));
      camera.setViewOffset(w, h, -w * off[0], -h * off[1], w, h);
      camera.updateProjectionMatrix();
    };
    const frameLoop = (now) => {
      if (!alive) return;
      resize();
      const t = (now - t0) / 1000;
      const aspect = w / h;
      const dist = (opts.dist || (aspect < 0.9 ? 24 : (aspect < 1.3 ? 19 : 17))) * zoom;
      if (!dragging && Math.abs(vel) > 0.0001) { ang += vel; vel *= 0.93; }
      if (resetT) {
        const k = Math.min(1, (now - resetT) / 600), e = 1 - Math.pow(1 - k, 3);
        ang += (baseAng - ang) * e; elev += (baseElev - elev) * e; zoom += (1 - zoom) * e;
        if (k >= 1) { resetT = 0; touched = false; }
      }
      const a = touched || reduce ? ang : baseAng + Math.sin(t * 0.12) * 0.07;
      if (!touched) ang = a;
      camera.position.set(Math.sin(a) * dist * Math.cos(elev), dist * Math.sin(elev), Math.cos(a) * dist * Math.cos(elev));
      camera.lookAt(0.2, -0.4, 0.2);
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        const k = Math.min(1, (now - tw.t0) / tw.dur);
        const e = 1 - Math.pow(1 - k, 3);
        tw.mesh.position.lerpVectors(tw.from, tw.to, e);
        tw.mesh.position.y = tw.to.y + Math.sin(Math.PI * k) * 0.5;
        if (k >= 1) { tw.mesh.position.copy(tw.to); tweens.splice(i, 1); }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frameLoop);
    };
    raf = requestAnimationFrame(frameLoop);
    return {
      setPosition,
      setPool: () => {},
      dispose: () => {
        alive = false; cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('dblclick', onDbl);
        canvas.removeEventListener('keydown', onKey);
        canvas.removeEventListener('wheel', onWheel);
        scene.traverse((o) => { if (o.geometry && disposables.indexOf(o.geometry) < 0) o.geometry.dispose(); });
        disposables.forEach((d) => d.dispose && d.dispose());
        envTex.dispose(); pmrem.dispose();
        renderer.dispose();
      }
    };
  }
