export type SoundType = "kick" | "snare" | "hihat" | "tom" | "perc" | "clap";

export type PadDef = {
  id: number;
  label: string;
  note: number;
  type: SoundType;
};

export type Kit = {
  id: string;
  name: string;
  prompt: string;
  bpm: number;
  pads: PadDef[];
  /** 16 steps of pad ids (one bar of 16ths). */
  groove: number[][];
};

export const GRID_ORDER = [13, 14, 15, 16, 9, 10, 11, 12, 5, 6, 7, 8, 1, 2, 3, 4] as const;

export const KEY_TO_PAD: Record<string, number> = {
  Digit1: 13,
  Digit2: 14,
  Digit3: 15,
  Digit4: 16,
  KeyQ: 9,
  KeyW: 10,
  KeyE: 11,
  KeyR: 12,
  KeyA: 5,
  KeyS: 6,
  KeyD: 7,
  KeyF: 8,
  KeyZ: 1,
  KeyX: 2,
  KeyC: 3,
  KeyV: 4,
};

function pads(
  rows: Array<[number, string, number, SoundType]>,
): PadDef[] {
  return rows.map(([id, label, note, type]) => ({ id, label, note, type }));
}

export const KITS: Kit[] = [
  {
    id: "techno",
    name: "Industrial Techno",
    prompt: "Heavy industrial techno, warehouse kick, metallic hats",
    bpm: 132,
    pads: pads([
      [13, "KICK 1", 36, "kick"],
      [14, "KICK 2", 37, "kick"],
      [15, "SNARE", 38, "snare"],
      [16, "CLAP", 39, "clap"],
      [9, "HAT C", 42, "hihat"],
      [10, "HAT O", 46, "hihat"],
      [11, "TOM L", 41, "tom"],
      [12, "TOM M", 43, "tom"],
      [5, "RIDE", 51, "perc"],
      [6, "CRASH", 49, "perc"],
      [7, "PERC 1", 54, "perc"],
      [8, "PERC 2", 56, "perc"],
      [1, "STAB", 60, "perc"],
      [2, "RIM", 37, "snare"],
      [3, "SHAKER", 70, "hihat"],
      [4, "FX", 75, "perc"],
    ]),
    groove: [
      [13, 9],
      [],
      [9],
      [7],
      [15, 9],
      [],
      [9],
      [],
      [13, 9],
      [14],
      [9],
      [],
      [15, 16, 9],
      [],
      [9, 3],
      [7],
    ],
  },
  {
    id: "soul",
    name: "Vintage Soul",
    prompt: "Vintage 70s soul, warm kick, dusty snare, tight hats",
    bpm: 92,
    pads: pads([
      [13, "KICK", 36, "kick"],
      [14, "KICK S", 37, "kick"],
      [15, "SNARE", 38, "snare"],
      [16, "RIM", 37, "snare"],
      [9, "HAT C", 42, "hihat"],
      [10, "HAT O", 46, "hihat"],
      [11, "TOM L", 41, "tom"],
      [12, "TOM H", 45, "tom"],
      [5, "CLAP", 39, "clap"],
      [6, "TAMBO", 54, "perc"],
      [7, "CONGA", 62, "tom"],
      [8, "RIDE", 51, "perc"],
      [1, "SHAKER", 70, "hihat"],
      [2, "SNAP", 37, "clap"],
      [3, "BELL", 84, "perc"],
      [4, "FX", 75, "perc"],
    ]),
    groove: [
      [13, 9],
      [1],
      [9, 16],
      [1],
      [15, 9, 5],
      [1],
      [9],
      [10],
      [13, 9],
      [1],
      [9],
      [1],
      [15, 9],
      [6],
      [9, 1],
      [16],
    ],
  },
  {
    id: "trap",
    name: "Night Trap",
    prompt: "Night trap, 808 knock, crisp snare, rolling hats",
    bpm: 140,
    pads: pads([
      [13, "808", 36, "kick"],
      [14, "KICK", 35, "kick"],
      [15, "SNARE", 38, "snare"],
      [16, "CLAP", 39, "clap"],
      [9, "HAT", 42, "hihat"],
      [10, "HAT O", 46, "hihat"],
      [11, "HAT R", 44, "hihat"],
      [12, "PERC", 56, "perc"],
      [5, "RIM", 37, "snare"],
      [6, "SNAP", 40, "clap"],
      [7, "TOM", 45, "tom"],
      [8, "FX", 75, "perc"],
      [1, "SHAKER", 70, "hihat"],
      [2, "RIDE", 51, "perc"],
      [3, "Vox", 60, "perc"],
      [4, "RISER", 81, "perc"],
    ]),
    groove: [
      [13, 9],
      [9],
      [11, 9],
      [9],
      [15, 16, 9],
      [9],
      [9, 11],
      [10],
      [14, 9],
      [9],
      [9, 12],
      [9],
      [15, 9],
      [9, 5],
      [11, 9],
      [9],
    ],
  },
  {
    id: "house",
    name: "Deep House",
    prompt: "Deep house, four-on-the-floor, open hats, room clap",
    bpm: 122,
    pads: pads([
      [13, "KICK", 36, "kick"],
      [14, "KICK S", 37, "kick"],
      [15, "CLAP", 39, "clap"],
      [16, "SNARE", 38, "snare"],
      [9, "HAT C", 42, "hihat"],
      [10, "HAT O", 46, "hihat"],
      [11, "SHAKER", 70, "hihat"],
      [12, "RIDE", 51, "perc"],
      [5, "TOM", 43, "tom"],
      [6, "PERC", 56, "perc"],
      [7, "CONGA", 62, "tom"],
      [8, "CRASH", 49, "perc"],
      [1, "STAB", 60, "perc"],
      [2, "RIM", 37, "snare"],
      [3, "FX", 75, "perc"],
      [4, "SWEEP", 81, "perc"],
    ]),
    groove: [
      [13],
      [11],
      [9],
      [11],
      [13, 15, 10],
      [11],
      [9],
      [11],
      [13],
      [11, 6],
      [9],
      [11],
      [13, 15, 10],
      [11],
      [9, 12],
      [11],
    ],
  },
];

export const DEFAULT_KIT: Kit = KITS[0] as Kit;
