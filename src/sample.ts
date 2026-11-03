import type { HouseModel } from './types';

// Shown before the first design, and used when the AI is unavailable.
export const SAMPLE_HOUSE: HouseModel = {
  name: '30x40 2BHK starter home',
  summary: 'Ground floor 2BHK on a 30x40 ft plot with parking, living, kitchen and two bedrooms.',
  plot: { width: 9.1, depth: 12.2 },
  roof: 'flat',
  style: { wall: '#f1ece2', roof: '#b9b2a6' },
  floors: [
    {
      level: 0,
      height: 3.0,
      rooms: [
        { id: 'r1', name: 'Parking', type: 'parking', x: 0, y: 0, w: 4.0, d: 4.5,
          openings: [] },
        { id: 'r2', name: 'Living', type: 'living', x: 4.0, y: 0, w: 5.1, d: 4.5,
          openings: [{ wall: 'front', kind: 'door', offset: 1.5, width: 1.0 },
                     { wall: 'front', kind: 'window', offset: 3.2, width: 1.4 }] },
        { id: 'r3', name: 'Kitchen', type: 'kitchen', x: 0, y: 4.5, w: 3.5, d: 3.5,
          openings: [{ wall: 'left', kind: 'window', offset: 1.0, width: 1.2 }] },
        { id: 'r4', name: 'Dining', type: 'dining', x: 3.5, y: 4.5, w: 3.0, d: 3.5 },
        { id: 'r5', name: 'Bath', type: 'bathroom', x: 6.5, y: 4.5, w: 2.6, d: 2.2,
          openings: [{ wall: 'front', kind: 'door', offset: 0.8, width: 0.8 }] },
        { id: 'r6', name: 'Stairs', type: 'stairs', x: 6.5, y: 6.7, w: 2.6, d: 1.3 },
        { id: 'r7', name: 'Bedroom 1', type: 'bedroom', x: 0, y: 8.0, w: 4.5, d: 4.2,
          openings: [{ wall: 'front', kind: 'door', offset: 3.2, width: 0.9 },
                     { wall: 'back', kind: 'window', offset: 1.5, width: 1.5 }] },
        { id: 'r8', name: 'Bedroom 2', type: 'bedroom', x: 4.5, y: 8.0, w: 4.6, d: 4.2,
          openings: [{ wall: 'front', kind: 'door', offset: 0.4, width: 0.9 },
                     { wall: 'back', kind: 'window', offset: 1.5, width: 1.5 }] },
      ],
    },
  ],
};
