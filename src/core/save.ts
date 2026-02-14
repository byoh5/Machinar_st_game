import type { GameSaveV1 } from './types';

export const SAVE_VERSION = 1;
const SAVE_KEY_PREFIX = 'machinar_mvp_save_v1';
const LEGACY_SAVE_KEY = 'machinar_mvp_save_v1';
const UNLOCKED_EPISODES_KEY = 'machinar_mvp_unlocked_episodes_v1';
const LAST_EPISODE_KEY = 'machinar_mvp_last_episode_v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

export const migrateSave = (unknownSave: unknown): GameSaveV1 | null => {
  if (!isRecord(unknownSave)) {
    return null;
  }

  const saveVersion = unknownSave.saveVersion;
  if (saveVersion !== SAVE_VERSION) {
    return null;
  }

  if (
    typeof unknownSave.episodeId !== 'string' ||
    typeof unknownSave.sceneId !== 'string' ||
    !isStringArray(unknownSave.inventory) ||
    !isStringArray(unknownSave.solvedPuzzles) ||
    typeof unknownSave.updatedAt !== 'string'
  ) {
    return null;
  }

  const flags = isRecord(unknownSave.flags) ? unknownSave.flags : {};
  const hintsUsed = isRecord(unknownSave.hintsUsed) ? unknownSave.hintsUsed : {};

  return {
    saveVersion: 1,
    episodeId: unknownSave.episodeId,
    sceneId: unknownSave.sceneId,
    inventory: unknownSave.inventory,
    solvedPuzzles: unknownSave.solvedPuzzles,
    flags: flags as Record<string, boolean | number | string>,
    hintsUsed: hintsUsed as Record<string, number>,
    updatedAt: unknownSave.updatedAt,
  };
};

const getEpisodeSaveKey = (episodeId: string): string => `${SAVE_KEY_PREFIX}:${episodeId}`;

export const loadSave = (episodeId: string): GameSaveV1 | null => {
  try {
    const raw = localStorage.getItem(getEpisodeSaveKey(episodeId));
    if (raw) {
      return migrateSave(JSON.parse(raw));
    }

    // Legacy migration: one-time fallback from the previous single-slot save key.
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacyRaw) {
      return null;
    }

    const migrated = migrateSave(JSON.parse(legacyRaw));
    if (migrated && migrated.episodeId === episodeId) {
      persistSave(migrated);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
};

export const persistSave = (save: GameSaveV1): void => {
  localStorage.setItem(getEpisodeSaveKey(save.episodeId), JSON.stringify(save));
  localStorage.setItem(LAST_EPISODE_KEY, save.episodeId);
};

export const clearSave = (episodeId: string): void => {
  localStorage.removeItem(getEpisodeSaveKey(episodeId));
};

export const loadUnlockedEpisodes = (defaultEpisodeId: string): string[] => {
  try {
    const raw = localStorage.getItem(UNLOCKED_EPISODES_KEY);
    if (!raw) {
      return [defaultEpisodeId];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [defaultEpisodeId];
    }

    const unique = parsed.filter((entry): entry is string => typeof entry === 'string');
    if (!unique.includes(defaultEpisodeId)) {
      unique.unshift(defaultEpisodeId);
    }

    return Array.from(new Set(unique));
  } catch {
    return [defaultEpisodeId];
  }
};

export const persistUnlockedEpisodes = (episodeIds: string[]): void => {
  const unique = Array.from(new Set(episodeIds.filter((entry) => entry.length > 0)));
  localStorage.setItem(UNLOCKED_EPISODES_KEY, JSON.stringify(unique));
};

export const getLastEpisodeId = (): string | null => {
  return localStorage.getItem(LAST_EPISODE_KEY);
};

export const setLastEpisodeId = (episodeId: string): void => {
  localStorage.setItem(LAST_EPISODE_KEY, episodeId);
};
