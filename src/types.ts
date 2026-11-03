// BuildFit AI house model. Units: metres. Origin = front-left corner of plot.
// x runs left→right (width), y runs front→back (depth).
export type RoomType =
  | 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'dining' | 'puja'
  | 'stairs' | 'parking' | 'balcony' | 'store' | 'study' | 'utility' | 'other';

export interface Opening {
  wall: 'front' | 'back' | 'left' | 'right';
  kind: 'door' | 'window';
  offset: number; // metres from the wall's start (left or front end)
  width: number;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number; y: number; w: number; d: number;
  openings?: Opening[];
}

export interface Floor {
  level: number; // 0 = ground
  height: number; // floor-to-floor, metres
  rooms: Room[];
}

export interface HouseModel {
  name: string;
  summary: string;
  plot: { width: number; depth: number };
  floors: Floor[];
  roof: 'flat' | 'gable';
  style: { wall: string; roof: string };
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  image?: string; // data URL preview
}
