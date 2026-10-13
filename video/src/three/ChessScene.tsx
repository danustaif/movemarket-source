// Adegan papan 3D untuk Remotion: semua gerak (bidak, kamera, debu, gelombang kejut) dihitung dari frame,
// tanpa state antar frame, supaya render paralel dan acak urutan tetap identik.
import React, { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useCurrentFrame } from "remotion";
import {
  AdditiveBlending, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PCFShadowMap,
  type PerspectiveCamera, PointLight, RingGeometry, SphereGeometry, Vector3,
} from "three";
import { createBoard, PIECE_SCALE, pieceMap, sqPos } from "./board";

export interface Move {
  from: string;
  to: string;
  /** Frame bidak mulai terangkat dan frame mendarat. */
  liftAt: number;
  landAt: number;
  /** Tinggi lengkung (satuan petak). */
  height?: number;
  /** Fraksi waktu sebelum jatuh menghantam (0..1). Makin besar makin lama melayang. */
  hover?: number;
  /** Tampilkan jejak (motion trail) saat jatuh. */
  trail?: boolean;
}

export interface Cam {
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
  /** Geser proyeksi (fraksi lebar, tinggi), seperti opsi offset di produk. */
  offset?: [number, number];
}

export interface Impact {
  at: number;
  square: string;
  strength?: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/** Posisi bidak yang sedang bergerak pada frame f (null = belum/selesai bergerak). */
export function movePos(m: Move, f: number): Vector3 | null {
  if (f < m.liftAt || f >= m.landAt) return null;
  const k = (f - m.liftAt) / (m.landAt - m.liftAt);
  const s = m.hover ?? 0.6;
  const h = m.height ?? 1.2;
  const a = sqPos(m.from), b = sqPos(m.to);
  const p = a.clone().lerp(b, easeInOut(clamp01(k / Math.min(1, s + 0.12))));
  // naik melambat sampai puncak, lalu jatuh makin cepat (hantaman)
  p.y = a.y + (k < s ? h * easeOut(k / s) : h * (1 - Math.pow((k - s) / (1 - s), 2.6)));
  return p;
}

/** Bilangan acak deterministik 0..1. */
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const DUST = 70;

export const ChessScene: React.FC<{
  fen: string;
  moves?: Move[];
  impacts?: Impact[];
  camera: (f: number) => Cam;
  /** Petak yang menyala emas setelah hantaman. */
  goldSquare?: { square: string; at: number };
}> = ({ fen, moves = [], impacts = [], camera, goldSquare }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const cam = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFShadowMap;
    gl.toneMappingExposure = 0.95;
    const board = createBoard(gl);
    const start = pieceMap(fen);
    const pieces = new Map<string, Group>();
    for (const [sq, ch] of Object.entries(start)) {
      const g = board.makePiece(ch);
      g.position.copy(sqPos(sq));
      board.root.add(g);
      pieces.set(sq, g);
    }
    // Jejak: 5 salinan bidak dengan material terang transparan.
    const trails = moves.map((m) => {
      const ch = start[m.from];
      return Array.from({ length: 5 }, (_, i) => {
        const g = board.makePiece(ch);
        const mat = new MeshBasicMaterial({ color: 0xffe7a8, transparent: true, opacity: 0.22 - i * 0.04, depthWrite: false, blending: AdditiveBlending });
        g.traverse((o) => {
          if (o instanceof Mesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; }
        });
        g.visible = false;
        board.root.add(g);
        return g;
      });
    });
    // Debu dan percikan per hantaman.
    const dustGeo = new SphereGeometry(0.03, 6, 4);
    const fx = impacts.map(() => {
      const dust = new InstancedMesh(dustGeo, new MeshBasicMaterial({ color: 0xfff1cf, transparent: true, depthWrite: false }), DUST);
      const ring = new Mesh(new RingGeometry(0.42, 0.5, 64), new MeshBasicMaterial({ color: 0xf2c14e, transparent: true, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      const light = new PointLight(0xffd27a, 0, 6, 1.6);
      board.root.add(dust, ring, light);
      return { dust, ring, light };
    });
    return { board, pieces, trails, fx, start };
    // Scene dibuat sekali per kanvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useLayoutEffect(() => {
    scene.environment = built.board.env;
    scene.add(built.board.root);
    return () => {
      scene.remove(built.board.root);
    };
  }, [scene, built]);

  useLayoutEffect(() => {
    const f = frame;
    const { board, pieces, trails, fx } = built;
    // bidak: posisi awal, lalu terapkan langkah yang sudah/sedang terjadi
    for (const [sq, g] of pieces) {
      g.position.copy(sqPos(sq));
      g.scale.setScalar(PIECE_SCALE);
      g.visible = true;
      g.rotation.set(0, 0, 0);
    }
    let lastMove: Move | undefined;
    moves.forEach((m, mi) => {
      const g = pieces.get(m.from);
      if (!g) return;
      const victim = pieces.get(m.to);
      const p = movePos(m, f);
      if (f >= m.landAt) {
        g.position.copy(sqPos(m.to));
        lastMove = m;
        if (victim) {
          // bidak termakan menyusut dan tenggelam
          const k = clamp01((f - m.landAt) / 10);
          victim.scale.setScalar(PIECE_SCALE * (1 - easeOut(k)));
          victim.position.y = sqPos(m.to).y - 0.3 * k;
          victim.visible = k < 1;
        }
      } else if (p) {
        g.position.copy(p);
        // goyang sedikit saat melayang
        const k = (f - m.liftAt) / (m.landAt - m.liftAt);
        g.rotation.z = Math.sin(k * Math.PI) * 0.12;
        g.rotation.y = Math.sin(k * Math.PI) * 0.5;
      }
      // jejak: posisi beberapa frame sebelumnya, hanya saat bergerak cepat
      trails[mi].forEach((t, i) => {
        const prev = movePos(m, f - (i + 1) * 0.7);
        const falling = (f - m.liftAt) / (m.landAt - m.liftAt) > (m.hover ?? 0.6) - 0.05;
        const fast = m.trail && falling && p && prev && prev.distanceTo(p) > 0.05;
        t.visible = !!fast;
        if (fast && prev) t.position.copy(prev);
      });
    });
    board.highlight(lastMove?.from, lastMove?.to);
    if (goldSquare && f >= goldSquare.at) {
      const s = board.squares.get(goldSquare.square);
      if (s) {
        s.material = board.goldMat;
        board.goldMat.emissiveIntensity = 0.15 + 1.1 * Math.exp(-(f - goldSquare.at) / 10);
      }
    }
    // efek hantaman
    const m4 = new Matrix4();
    let shake = 0;
    impacts.forEach((imp, i) => {
      const { dust, ring, light } = fx[i];
      const dt = f - imp.at;
      const st = imp.strength ?? 1;
      const on = dt >= 0 && dt < 45;
      dust.visible = ring.visible = on;
      light.intensity = dt >= 0 ? 40 * st * Math.exp(-dt / 5) : 0;
      const c = sqPos(imp.square);
      light.position.set(c.x, 0.6, c.z);
      if (!on) return;
      shake += st * 0.07 * Math.exp(-dt / 6) * Math.sin(dt * 2.4);
      for (let j = 0; j < DUST; j++) {
        const a = rand(j + i * 100) * Math.PI * 2;
        const v = (0.04 + rand(j + 7 + i * 100) * 0.09) * st;
        const up = (0.02 + rand(j + 13 + i * 100) * 0.07) * st;
        const t = dt * 0.85;
        const x = c.x + Math.cos(a) * (0.32 + v * t * (1 - t / 120));
        const z = c.z + Math.sin(a) * (0.32 + v * t * (1 - t / 120));
        const y = Math.max(0.09, 0.09 + up * t - 0.0016 * t * t);
        const s = (1 - dt / 45) * (0.6 + rand(j + 21) * 0.9);
        m4.makeScale(s, s, s).setPosition(x, y, z);
        dust.setMatrixAt(j, m4);
      }
      dust.instanceMatrix.needsUpdate = true;
      (dust.material as MeshBasicMaterial).opacity = 0.85 * (1 - dt / 45);
      const rk = clamp01(dt / 22);
      ring.position.set(c.x, 0.1, c.z);
      ring.scale.setScalar(0.6 + easeOut(rk) * 4.5 * st);
      (ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - rk);
    });
    // kamera
    const c = camera(f);
    cam.fov = c.fov ?? 28;
    cam.near = 0.05;
    cam.far = 100;
    cam.aspect = size.width / size.height;
    const off = c.offset ?? [0, 0];
    cam.setViewOffset(size.width, size.height, -size.width * off[0], -size.height * off[1], size.width, size.height);
    cam.position.set(c.pos[0] + shake, c.pos[1] + shake * 0.6, c.pos[2]);
    cam.lookAt(new Vector3(...c.look));
    cam.updateProjectionMatrix();
  }, [frame, built, moves, impacts, camera, cam, goldSquare, size]);

  return null;
};
