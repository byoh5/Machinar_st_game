export type EpisodeId = string;
export type SceneId = string;
export type ItemId = string;
export type PuzzleId = string;

export type FlagValue = boolean | number | string;

export interface GameSaveV1 {
  saveVersion: 1;
  episodeId: EpisodeId;
  sceneId: SceneId;
  inventory: ItemId[];
  solvedPuzzles: PuzzleId[];
  flags: Record<string, FlagValue>;
  hintsUsed?: Record<PuzzleId, number>;
  updatedAt: string;
}

export interface EpisodeManifest {
  id: EpisodeId;
  title: string;
  startSceneId: SceneId;
  scenes: SceneDef[];
  puzzles: PuzzleDef[];
}

export interface SceneDef {
  id: SceneId;
  title: string;
  description: string;
  background: string;
  hotspots: HotspotDef[];
  ambientSfx?: string;
}

export type HotspotAction =
  | { type: 'goto'; sceneId: SceneId }
  | { type: 'pickup'; itemId: ItemId }
  | { type: 'use_item'; requiredItemId: ItemId; successFlag: string }
  | { type: 'open_puzzle'; puzzleId: PuzzleId };

export interface HotspotDef {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: HotspotAction;
  hintKey?: string;
  requiredFlag?: string;
  requiredItemId?: ItemId;
  blockedText?: string;
}

export type PuzzleType =
  | 'sequence'
  | 'pattern_lock'
  | 'inventory_combine'
  | 'timed_switch'
  | 'logic_grid';

export interface PuzzleDef {
  id: PuzzleId;
  type: PuzzleType;
  title: string;
  prompt: string;
  config: Record<string, unknown>;
  successSetFlags: string[];
  hints: [string, string, string];
}
