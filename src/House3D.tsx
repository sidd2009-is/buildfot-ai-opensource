import { useMemo, type JSX } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Grid } from '@react-three/drei';
import type { HouseModel, Room, Opening } from './types';

export const ROOM_COLORS: Record<string, string> = {
  living: '#e9d8b4', bedroom: '#c9dbe8', kitchen: '#f2c9a5', bathroom: '#b8e0dc',
  dining: '#ead3c0', puja: '#f5e08a', stairs: '#cfcfcf', parking: '#bdbdbd',
  balcony: '#cde3c0', store: '#d9cfc4', study: '#d7cbe6', utility: '#d0d8d0', other: '#e4e0d8',
};

const T = 0.12; // wall thickness
const DOOR_H = 2.1, SILL = 0.9, WIN_TOP = 2.1;

interface Seg { a: number; b: number; y0: number; y1: number }

// Split one wall of length L into solid segments around openings.
function wallSegments(L: number, H: number, ops: Opening[]): Seg[] {
  const segs: Seg[] = [];
  const sorted = [...ops].sort((p, q) => p.offset - q.offset);
  let cur = 0;
  for (const o of sorted) {
    const a = Math.max(cur, o.offset), b = Math.min(L, o.offset + o.width);
    if (b <= a) continue;
    if (a > cur) segs.push({ a: cur, b: a, y0: 0, y1: H });
    if (o.kind === 'door') {
      segs.push({ a, b, y0: DOOR_H, y1: H });
    } else {
      segs.push({ a, b, y0: 0, y1: SILL });
      segs.push({ a, b, y0: WIN_TOP, y1: H });
    }
    cur = b;
  }
  if (cur < L) segs.push({ a: cur, b: L, y0: 0, y1: H });
  return segs.filter((s) => s.y1 - s.y0 > 0.01 && s.b - s.a > 0.01);
}

function RoomMesh({ room, base, H, W, D, wallColor, selected, onSelect, showLabel, cut }: {
  room: Room; base: number; H: number; cut: boolean; W: number; D: number; wallColor: string;
  selected: boolean; onSelect: (id: string) => void; showLabel: boolean;
}) {
  // plan (x,y) -> world (x - W/2, -, D/2 - y); front of plot faces +z
  const wx = (x: number) => x - W / 2;
  const wz = (y: number) => D / 2 - y;
  const cx = wx(room.x + room.w / 2), cz = wz(room.y + room.d / 2);
  const ops = room.openings || [];
  const walls: JSX.Element[] = [];
  const sides: Array<['front' | 'back' | 'left' | 'right', number]> = [
    ['front', room.w], ['back', room.w], ['left', room.d], ['right', room.d],
  ];
  const open = room.type === 'parking' || room.type === 'balcony';
  const wallH = open ? 0.9 : cut ? 1.2 : H - 0.05;
  for (const [side, L] of sides) {
    if (open && side === 'front') continue;
    wallSegments(L, wallH, ops.filter((o) => o.wall === side)).forEach((s, i) => {
      const mid = (s.a + s.b) / 2, len = s.b - s.a, h = s.y1 - s.y0, y = base + s.y0 + h / 2;
      let pos: [number, number, number], size: [number, number, number];
      if (side === 'front') { pos = [wx(room.x + mid), y, wz(room.y) - T / 2]; size = [len, h, T]; }
      else if (side === 'back') { pos = [wx(room.x + mid), y, wz(room.y + room.d) + T / 2]; size = [len, h, T]; }
      else if (side === 'left') { pos = [wx(room.x) + T / 2, y, wz(room.y + mid)]; size = [T, h, len]; }
      else { pos = [wx(room.x + room.w) - T / 2, y, wz(room.y + mid)]; size = [T, h, len]; }
      walls.push(
        <mesh key={`${side}${i}`} position={pos} castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={selected ? '#ffb347' : wallColor} />
        </mesh>,
      );
    });
  }
  return (
    <group>
      <mesh position={[cx, base + 0.03, cz]} receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(room.id); }}>
        <boxGeometry args={[room.w - 0.02, 0.06, room.d - 0.02]} />
        <meshStandardMaterial color={selected ? '#ffd28a' : ROOM_COLORS[room.type] || '#ddd'} />
      </mesh>
      {walls}
      {showLabel && (
        <Html position={[cx, base + 0.4, cz]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className={`label ${selected ? 'sel' : ''}`} onClick={() => onSelect(room.id)}>
            {room.name}<small>{room.w.toFixed(1)}×{room.d.toFixed(1)} m</small>
          </div>
        </Html>
      )}
    </group>
  );
}

function Roof({ model, base, W, D }: { model: HouseModel; base: number; W: number; D: number }) {
  const top = model.floors[model.floors.length - 1];
  if (!top?.rooms.length) return null;
  const minX = Math.min(...top.rooms.map((r) => r.x)), maxX = Math.max(...top.rooms.map((r) => r.x + r.w));
  const minY = Math.min(...top.rooms.map((r) => r.y)), maxY = Math.max(...top.rooms.map((r) => r.y + r.d));
  const w = maxX - minX + 0.4, d = maxY - minY + 0.4;
  const cx = (minX + maxX) / 2 - W / 2, cz = D / 2 - (minY + maxY) / 2;
  if (model.roof === 'gable') {
    const rise = Math.min(2.2, w * 0.3);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, rise); shape.closePath();
    return (
      <mesh position={[cx, base, cz - d / 2]} castShadow>
        <extrudeGeometry args={[shape, { depth: d, bevelEnabled: false }]} />
        <meshStandardMaterial color={model.style.roof} />
      </mesh>
    );
  }
  return (
    <mesh position={[cx, base + 0.1, cz]} castShadow>
      <boxGeometry args={[w, 0.2, d]} />
      <meshStandardMaterial color={model.style.roof} />
    </mesh>
  );
}

export default function House3D({ model, selectedId, onSelect, visibleFloors, showRoof, topView, cutaway }: {
  model: HouseModel; selectedId: string | null; onSelect: (id: string | null) => void;
  visibleFloors: number; showRoof: boolean; topView: boolean; cutaway: boolean;
}) {
  const W = model.plot.width, D = model.plot.depth;
  const bases = useMemo(() => {
    let acc = 0;
    return model.floors.map((f) => { const b = acc; acc += f.height; return b; });
  }, [model]);
  const shown = model.floors.slice(0, visibleFloors);
  const roofBase = bases[shown.length - 1] + (shown[shown.length - 1]?.height ?? 0);
  const span = Math.max(W, D);
  const cam: [number, number, number] = topView ? [0, span * 1.9, 0.01] : [span * 0.7, span * 1.35, span * 1.2];

  return (
    <Canvas key={topView ? 'top' : '3d'} shadows camera={{ position: cam, fov: 40 }} gl={{ preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={['#eef2f5']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[span, span * 2, span]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
      {/* plot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#cfe3c4" />
      </mesh>
      <Grid args={[80, 80]} cellSize={1} sectionSize={5} position={[0, -0.02, 0]} cellColor="#d6dde3" sectionColor="#b8c2cc" fadeDistance={60} infiniteGrid />
      {shown.map((f, i) => (
        <group key={f.level}>
          {f.rooms.map((r) => (
            <RoomMesh key={r.id} room={r} base={bases[i]} H={f.height} W={W} D={D}
              wallColor={model.style.wall} selected={r.id === selectedId} onSelect={onSelect}
              showLabel={i === shown.length - 1} cut={cutaway && !showRoof && i === shown.length - 1} />
          ))}
          {i > 0 && f.rooms.map((r) => (
            <mesh key={`slab${r.id}`} position={[r.x + r.w / 2 - W / 2, bases[i] - 0.05, D / 2 - (r.y + r.d / 2)]}>
              <boxGeometry args={[r.w, 0.1, r.d]} />
              <meshStandardMaterial color="#d8d2c8" />
            </mesh>
          ))}
        </group>
      ))}
      {showRoof && shown.length === model.floors.length && <Roof model={model} base={roofBase} W={W} D={D} />}
      <Html position={[0, 0.05, D / 2 + 0.8]} center><div className="road">Front / Road</div></Html>
      <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={topView ? 0.01 : Math.PI / 2.05} enableRotate={!topView} />
    </Canvas>
  );
}
