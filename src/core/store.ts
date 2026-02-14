import type {
  EpisodeManifest,
  FlagValue,
  GameSaveV1,
  ItemId,
  PuzzleId,
  SceneId,
} from './types';

export interface RuntimeState {
  episodeId: string;
  sceneId: SceneId;
  inventory: ItemId[];
  solvedPuzzles: PuzzleId[];
  flags: Record<string, FlagValue>;
  hintsUsed: Record<PuzzleId, number>;
  visitedScenes: SceneId[];
  seenStoryKeys: string[];
  selectedItemId: ItemId | null;
}

const cloneFlags = (flags: Record<string, FlagValue>): Record<string, FlagValue> => ({
  ...flags,
});

const cloneHints = (hints: Record<PuzzleId, number>): Record<PuzzleId, number> => ({
  ...hints,
});

const cloneList = <T>(entries: T[]): T[] => [...entries];

export class GameStore {
  private state: RuntimeState;
  private readonly episode: EpisodeManifest;

  constructor(episode: EpisodeManifest) {
    this.episode = episode;
    this.state = this.initialState();
  }

  private initialState(): RuntimeState {
    return {
      episodeId: this.episode.id,
      sceneId: this.episode.startSceneId,
      inventory: [],
      solvedPuzzles: [],
      flags: {},
      hintsUsed: {},
      visitedScenes: [this.episode.startSceneId],
      seenStoryKeys: [],
      selectedItemId: null,
    };
  }

  reset(): void {
    this.state = this.initialState();
  }

  hydrate(save: GameSaveV1): void {
    this.state = {
      episodeId: save.episodeId,
      sceneId: save.sceneId,
      inventory: [...save.inventory],
      solvedPuzzles: [...save.solvedPuzzles],
      flags: cloneFlags(save.flags),
      hintsUsed: cloneHints(save.hintsUsed ?? {}),
      visitedScenes: cloneList(save.visitedScenes ?? [save.sceneId]),
      seenStoryKeys: cloneList(save.seenStoryKeys ?? []),
      selectedItemId: null,
    };
  }

  toSave(): GameSaveV1 {
    return {
      saveVersion: 1,
      episodeId: this.state.episodeId,
      sceneId: this.state.sceneId,
      inventory: [...this.state.inventory],
      solvedPuzzles: [...this.state.solvedPuzzles],
      flags: cloneFlags(this.state.flags),
      hintsUsed: cloneHints(this.state.hintsUsed),
      visitedScenes: cloneList(this.state.visitedScenes),
      seenStoryKeys: cloneList(this.state.seenStoryKeys),
      updatedAt: new Date().toISOString(),
    };
  }

  getSnapshot(): RuntimeState {
    return {
      episodeId: this.state.episodeId,
      sceneId: this.state.sceneId,
      inventory: [...this.state.inventory],
      solvedPuzzles: [...this.state.solvedPuzzles],
      flags: cloneFlags(this.state.flags),
      hintsUsed: cloneHints(this.state.hintsUsed),
      visitedScenes: cloneList(this.state.visitedScenes),
      seenStoryKeys: cloneList(this.state.seenStoryKeys),
      selectedItemId: this.state.selectedItemId,
    };
  }

  gotoScene(sceneId: SceneId): boolean {
    const exists = this.episode.scenes.some((scene) => scene.id === sceneId);
    if (!exists) {
      return false;
    }

    this.state.sceneId = sceneId;
    if (!this.state.visitedScenes.includes(sceneId)) {
      this.state.visitedScenes.push(sceneId);
    }
    return true;
  }

  addItem(itemId: ItemId): boolean {
    if (this.state.inventory.includes(itemId)) {
      return false;
    }

    this.state.inventory.push(itemId);
    return true;
  }

  removeItem(itemId: ItemId): boolean {
    const before = this.state.inventory.length;
    this.state.inventory = this.state.inventory.filter((id) => id !== itemId);

    if (this.state.selectedItemId === itemId) {
      this.state.selectedItemId = null;
    }

    return this.state.inventory.length !== before;
  }

  hasItem(itemId: ItemId): boolean {
    return this.state.inventory.includes(itemId);
  }

  selectItem(itemId: ItemId | null): void {
    if (itemId === null) {
      this.state.selectedItemId = null;
      return;
    }

    if (!this.state.inventory.includes(itemId)) {
      return;
    }

    this.state.selectedItemId = this.state.selectedItemId === itemId ? null : itemId;
  }

  getSelectedItem(): ItemId | null {
    return this.state.selectedItemId;
  }

  isPuzzleSolved(puzzleId: PuzzleId): boolean {
    return this.state.solvedPuzzles.includes(puzzleId);
  }

  solvePuzzle(puzzleId: PuzzleId): boolean {
    if (this.isPuzzleSolved(puzzleId)) {
      return false;
    }

    this.state.solvedPuzzles.push(puzzleId);
    return true;
  }

  setFlag(key: string, value: FlagValue): void {
    this.state.flags[key] = value;
  }

  getFlag(key: string): FlagValue | undefined {
    return this.state.flags[key];
  }

  incrementHintUsage(puzzleId: PuzzleId): number {
    const current = this.state.hintsUsed[puzzleId] ?? 0;
    const next = Math.min(3, current + 1);
    this.state.hintsUsed[puzzleId] = next;
    return next;
  }

  getHintUsage(puzzleId: PuzzleId): number {
    return this.state.hintsUsed[puzzleId] ?? 0;
  }

  hasVisitedScene(sceneId: SceneId): boolean {
    return this.state.visitedScenes.includes(sceneId);
  }

  markStorySeen(storyKey: string): void {
    if (!this.state.seenStoryKeys.includes(storyKey)) {
      this.state.seenStoryKeys.push(storyKey);
    }
  }

  hasSeenStory(storyKey: string): boolean {
    return this.state.seenStoryKeys.includes(storyKey);
  }
}
