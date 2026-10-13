// Papan 3D untuk video, port dari fe/src/components/board/scene3d.ts (three r186): geometri, material,
// lampu, dan lingkungan pantulan yang sama persis dengan produk. Bagian input, loop rAF, dan tween dibuang;
// di video semua gerak dihitung dari nomor frame (lihat ChessScene.tsx).
import {
  BackSide, BoxGeometry, type BufferGeometry, CanvasTexture, CylinderGeometry, DirectionalLight, DoubleSide,
  ExtrudeGeometry, Group, HemisphereLight, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  type MeshPhysicalMaterialParameters, type Object3D, PlaneGeometry, PMREMGenerator, Scene, Shape, ShadowMaterial,
  SphereGeometry, SRGBColorSpace, type Texture, Vector2, Vector3, type WebGLRenderer,
} from "three";

const FILES = "abcdefgh";
const LIGHT_SCALE = Math.PI;
export const PIECE_SCALE = 0.86;

/** Petak berisi bidak dari FEN: { e4: "N", ... } (huruf besar = putih). */
export function pieceMap(fen: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  for (const ch of fen.split(" ")[0]) {
    if (ch === "/") continue;
    if (/\d/.test(ch)) i += Number(ch);
    else {
      out[`${FILES[i % 8]}${8 - Math.floor(i / 8)}`] = ch;
      i++;
    }
  }
  return out;
}

export const sqPos = (s: string) => new Vector3(FILES.indexOf(s[0]) - 3.5, 0.075, 3.5 - (Number(s[1]) - 1));

export interface Board {
  root: Group;
  env: Texture;
  key: DirectionalLight;
  makePiece(ch: string): Group;
  /** Sorot dua petak (langkah terakhir) dengan warna produk; `gold` = petak pendaratan hook. */
  highlight(a?: string, b?: string): void;
  squares: Map<string, Mesh>;
  goldMat: MeshPhysicalMaterial;
}

export function createBoard(renderer: WebGLRenderer): Board {
  const scene = new Group();

  // Lingkungan pantulan: ruang teal redup dengan dua softbox.
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();
  envScene.add(new Mesh(new BoxGeometry(24, 12, 24), new MeshBasicMaterial({ color: 0x0f2f2b, side: BackSide })));
  const panel = (w: number, h: number, rgb: [number, number, number], pos: [number, number, number], rot: [number, number, number]) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ side: DoubleSide }));
    m.material.color.setRGB(...rgb);
    m.position.set(...pos);
    m.rotation.set(...rot);
    envScene.add(m);
  };
  panel(10, 6, [2.2, 2.05, 1.8], [-4, 5.9, 3], [Math.PI / 2, 0, 0]);
  panel(6, 4, [0.35, 1.1, 0.95], [11.9, 3, -4], [0, -Math.PI / 2, 0]);
  panel(5, 3, [1.4, 1.1, 0.6], [-11.9, 2, 5], [0, Math.PI / 2, 0]);
  const env = pmrem.fromScene(envScene, 0.035).texture;
  pmrem.dispose();

  scene.add(new HemisphereLight(0xd9efe9, 0x0d3a35, 0.25 * LIGHT_SCALE));
  const key = new DirectionalLight(0xffe6bd, 2.1 * LIGHT_SCALE);
  key.position.set(-5, 11, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new DirectionalLight(0x86e0cf, 0.8 * LIGHT_SCALE);
  rim.position.set(7, 4, -8);
  scene.add(rim);

  const root = new Group();
  scene.add(root);
  const floor = new Mesh(new PlaneGeometry(60, 60), new ShadowMaterial({ opacity: 0.34 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.64;
  floor.receiveShadow = true;
  scene.add(floor);

  const phys = (color: number, roughness: number, o: MeshPhysicalMaterialParameters = {}) =>
    new MeshPhysicalMaterial({ color, roughness, envMapIntensity: 0.8, ...o });
  const rrect = (w: number, h: number, r: number) => {
    const s = new Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const flatExtrude = (shape: Shape, depth: number, bevel: number, segs = 3) => {
    const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 12 });
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const add = (o: Object3D, y: number, shadow: { cast?: boolean; receive?: boolean } = {}) => {
    o.position.y = y;
    o.castShadow = !!shadow.cast;
    o.receiveShadow = !!shadow.receive;
    root.add(o);
  };

  // Papan: alas, bingkai lacquer dengan inlay emas, petak berbevel.
  add(new Mesh(flatExtrude(rrect(10.3, 10.3, 0.3), 0.1, 0.03), phys(0x041613, 0.7, { envMapIntensity: 0.3 })), -0.6, { cast: true, receive: true });
  const frameShape = rrect(9.9, 9.9, 0.22);
  frameShape.holes.push(rrect(8.2, 8.2, 0.02));
  add(new Mesh(flatExtrude(frameShape, 0.5, 0.06, 4), phys(0x0b3a33, 0.34, { clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 0.55 })), -0.48, { cast: true, receive: true });
  add(new Mesh(new BoxGeometry(8.24, 0.5, 8.24), phys(0x041a17, 0.8)), -0.26, { receive: true });
  const inlayShape = rrect(8.72, 8.72, 0.06);
  inlayShape.holes.push(rrect(8.56, 8.56, 0.04));
  add(new Mesh(flatExtrude(inlayShape, 0.012, 0), phys(0xd6b04f, 0.28, { metalness: 0.85 })), 0.082);

  const sq = { clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 0.4 };
  const mats = {
    l: phys(0xe2dfc2, 0.6, sq), d: phys(0x2f6e5e, 0.55, sq),
    hl: phys(0xf5f08a, 0.5, sq), hd: phys(0xb8c95c, 0.5, sq),
  };
  const goldMat = phys(0xf2c14e, 0.35, { ...sq, emissive: 0xf2c14e, emissiveIntensity: 0 });
  const sqGeo = flatExtrude(rrect(0.96, 0.96, 0.03), 0.05, 0.018, 2);
  const squares = new Map<string, Mesh>();
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const dark = (f + r) % 2 === 0;
      const m = new Mesh(sqGeo, dark ? mats.d : mats.l);
      m.position.set(f - 3.5, 0, 3.5 - r);
      m.receiveShadow = true;
      m.userData.dark = dark;
      root.add(m);
      squares.set(`${FILES[f]}${r + 1}`, m);
    }
  }
  const labelTex = (txt: string) => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#b8d3ce"; g.font = "700 40px Archivo, Arial, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 32, 34);
    }
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const labelGeo = new PlaneGeometry(0.32, 0.32);
  for (let i = 0; i < 8; i++) {
    const fm = new Mesh(labelGeo, new MeshBasicMaterial({ map: labelTex(FILES[i]), transparent: true }));
    fm.rotation.x = -Math.PI / 2; fm.position.set(i - 3.5, 0.09, 4.58); root.add(fm);
    const rm = new Mesh(labelGeo, new MeshBasicMaterial({ map: labelTex(String(i + 1)), transparent: true }));
    rm.rotation.x = -Math.PI / 2; rm.position.set(-4.58, 0.09, 3.5 - i); root.add(rm);
  }

  // Bidak: profil bubut dengan kerah dan mahkota, kuda dipahat.
  const V = (pts: number[][]) => pts.map(([x, y]) => new Vector2(x, y));
  const ball = (cy: number, r: number, from: number) => {
    const out: number[][] = [];
    for (let a = from; a <= 90; a += 10) out.push([r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]);
    return out;
  };
  const base = [[0, 0], [0.35, 0], [0.36, 0.015], [0.36, 0.06], [0.34, 0.085], [0.3, 0.1], [0.3, 0.125], [0.27, 0.15], [0.24, 0.175], [0.21, 0.2]];
  const profiles: Record<string, number[][]> = {
    p: [...base, [0.17, 0.24], [0.13, 0.32], [0.11, 0.4], [0.18, 0.43], [0.19, 0.455], [0.17, 0.475], [0.1, 0.49], ...ball(0.6, 0.14, -50)],
    r: [...base, [0.2, 0.28], [0.19, 0.5], [0.2, 0.56], [0.25, 0.6], [0.27, 0.63], [0.27, 0.66], [0.25, 0.68], [0.27, 0.7], [0.27, 0.8], [0.19, 0.8], [0.19, 0.74], [0, 0.74]],
    b: [...base, [0.16, 0.3], [0.12, 0.46], [0.1, 0.58], [0.2, 0.62], [0.21, 0.645], [0.19, 0.665], [0.11, 0.68], [0.14, 0.74], [0.18, 0.84], [0.175, 0.93], [0.14, 1.0], [0.08, 1.06], [0.04, 1.09], ...ball(1.135, 0.05, -40)],
    q: [...base, [0.17, 0.3], [0.13, 0.5], [0.11, 0.7], [0.23, 0.74], [0.24, 0.765], [0.22, 0.785], [0.12, 0.8], [0.14, 0.9], [0.2, 1.0], [0.25, 1.05], [0.25, 1.085], [0.19, 1.08], [0.1, 1.1], [0.06, 1.14], ...ball(1.19, 0.06, -40)],
    k: [...base, [0.17, 0.32], [0.13, 0.55], [0.11, 0.74], [0.24, 0.78], [0.25, 0.805], [0.23, 0.825], [0.12, 0.84], [0.15, 0.96], [0.21, 1.08], [0.23, 1.11], [0.23, 1.14], [0.16, 1.15], [0.08, 1.17], [0, 1.175]],
    n: [...base, [0.23, 0.22], [0.25, 0.24], [0.25, 0.28], [0, 0.28]],
  };
  const geos = Object.fromEntries(Object.entries(profiles).map(([k, p]) => [k, new LatheGeometry(V(p), 48)]));
  const head = new Shape();
  head.moveTo(-0.2, 0.26); head.lineTo(0.15, 0.26);
  head.quadraticCurveTo(0.11, 0.42, 0.24, 0.5);
  head.quadraticCurveTo(0.38, 0.56, 0.42, 0.62);
  head.quadraticCurveTo(0.46, 0.68, 0.4, 0.73);
  head.quadraticCurveTo(0.3, 0.77, 0.2, 0.78);
  head.quadraticCurveTo(0.16, 0.9, 0.09, 0.97);
  head.lineTo(0.07, 1.06); head.lineTo(0.0, 1.0);
  head.quadraticCurveTo(-0.16, 0.93, -0.22, 0.74);
  head.quadraticCurveTo(-0.29, 0.5, -0.2, 0.26);
  const headGeo = new ExtrudeGeometry(head, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 5, curveSegments: 18 });
  headGeo.translate(0, 0, -0.1);
  const mane = new Shape();
  mane.moveTo(-0.02, 0.98); mane.quadraticCurveTo(-0.2, 0.92, -0.26, 0.7); mane.quadraticCurveTo(-0.3, 0.5, -0.24, 0.3);
  mane.lineTo(-0.2, 0.3); mane.quadraticCurveTo(-0.25, 0.52, -0.2, 0.72); mane.quadraticCurveTo(-0.14, 0.88, 0.0, 0.95);
  const maneGeo = new ExtrudeGeometry(mane, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 14 });
  maneGeo.translate(-0.01, 0, -0.05);
  const eyeGeo = new SphereGeometry(0.024, 12, 8);
  const cross = new Shape();
  [[-0.035, 0], [0.035, 0], [0.035, 0.11], [0.1, 0.11], [0.1, 0.165], [0.035, 0.165], [0.035, 0.26], [-0.035, 0.26], [-0.035, 0.165], [-0.1, 0.165], [-0.1, 0.11], [-0.035, 0.11]]
    .forEach(([x, y], i) => (i ? cross.lineTo(x, y) : cross.moveTo(x, y)));
  const crossGeo = new ExtrudeGeometry(cross, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 });
  crossGeo.translate(0, 1.16, -0.025);
  const merlonGeo = new BoxGeometry(0.12, 0.1, 0.1);
  const pearlGeo = new SphereGeometry(0.036, 12, 8);
  const slitGeo = new BoxGeometry(0.03, 0.2, 0.3);
  const feltGeo = new CylinderGeometry(0.335, 0.335, 0.012, 40);
  const pMat = {
    w: phys(0xe9e2d2, 0.34, { clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.7 }),
    b: phys(0x1a201f, 0.22, { metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.12 }),
  };
  const darkMat = phys(0x0a0d0c, 0.5);
  const feltMat = phys(0x0f3a33, 1);

  const makePiece = (ch: string) => {
    const color = ch === ch.toUpperCase() ? "w" : "b";
    const t = ch.toLowerCase();
    const g = new Group();
    const part = (geo: BufferGeometry, mat = pMat[color]) => {
      const m = new Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    part(geos[t]);
    const felt = part(feltGeo, feltMat);
    felt.position.y = -0.004;
    felt.castShadow = false;
    if (t === "n") {
      const face = color === "w" ? Math.PI / 2 : -Math.PI / 2;
      part(headGeo).rotation.y = face;
      part(maneGeo).rotation.y = face;
      for (const sd of [-1, 1]) {
        const e = part(eyeGeo, darkMat);
        const lx = 0.2, lz = sd * 0.15;
        e.position.set(Math.cos(face) * lx + Math.sin(face) * lz, 0.8, -Math.sin(face) * lx + Math.cos(face) * lz);
      }
    }
    if (t === "k") part(crossGeo);
    if (t === "r") {
      for (let i = 0; i < 6; i++) {
        const m = part(merlonGeo);
        const a = (i / 6) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.23, 0.85, Math.sin(a) * 0.23);
        m.rotation.y = -a;
      }
    }
    if (t === "q") {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        part(pearlGeo).position.set(Math.cos(a) * 0.235, 1.1, Math.sin(a) * 0.235);
      }
    }
    if (t === "b") {
      const s = part(slitGeo, darkMat);
      s.position.set(0.09, 0.92, 0);
      s.rotation.z = -0.6;
      s.scale.set(1, 0.9, 0.55);
      s.castShadow = false;
    }
    g.scale.setScalar(PIECE_SCALE);
    g.userData.type = ch;
    return g;
  };

  const highlight = (a?: string, b?: string) => {
    for (const [k, s] of squares) {
      const lit = k === a || k === b;
      s.material = s.userData.dark ? (lit ? mats.hd : mats.d) : (lit ? mats.hl : mats.l);
    }
  };

  return { root: scene, env, key, makePiece, highlight, squares, goldMat };
}
