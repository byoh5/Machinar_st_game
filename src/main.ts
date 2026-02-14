import './style.css';

import { defaultEpisode, episodeList } from './content/episodes';
import { canActivateHotspot } from './core/game';
import {
  clearSave,
  getLastEpisodeId,
  loadSave,
  loadUnlockedEpisodes,
  persistSave,
  persistUnlockedEpisodes,
  setLastEpisodeId,
} from './core/save';
import { GameStore } from './core/store';
import type { EpisodeManifest, HotspotDef, ObjectiveRule, PuzzleDef } from './core/types';
import { createGameRenderer } from './engine/createGameRenderer';
import { validatePuzzleAttempt } from './puzzles/validators';
import { DOMUI, type ObjectiveView } from './ui/domUI';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing #app element');
}

const episodeMap = new Map(episodeList.map((episode) => [episode.id, episode]));
const getEpisodeById = (episodeId: string): EpisodeManifest | null => episodeMap.get(episodeId) ?? null;

let unlockedEpisodeIds = loadUnlockedEpisodes(defaultEpisode.id);
persistUnlockedEpisodes(unlockedEpisodeIds);

const restoreEpisodeId = getLastEpisodeId();
let activeEpisode =
  (restoreEpisodeId && unlockedEpisodeIds.includes(restoreEpisodeId) && getEpisodeById(restoreEpisodeId)) ||
  defaultEpisode;

let store = new GameStore(activeEpisode);
const initialSave = loadSave(activeEpisode.id);
if (initialSave) {
  store.hydrate(initialSave);
}

let completionAnnounced = false;
let lastSceneId: string | null = null;

const ui = new DOMUI(root, {
  onSave: () => {
    persistSave(store.toSave());
    ui.showMessage(`진행 상황 저장: ${activeEpisode.title}`);
  },
  onLoad: () => {
    const save = loadSave(activeEpisode.id);
    if (!save || save.episodeId !== activeEpisode.id) {
      ui.showMessage('현재 에피소드의 저장 데이터가 없습니다.');
      return;
    }

    store.hydrate(save);
    completionAnnounced = false;
    lastSceneId = null;
    ui.closePuzzleModal();
    ui.closeStoryModal();
    ui.showMessage(`불러오기 완료: ${activeEpisode.title}`);
    refresh();
  },
  onReset: () => {
    clearSave(activeEpisode.id);
    store.reset();
    completionAnnounced = false;
    lastSceneId = null;
    ui.closePuzzleModal();
    ui.closeStoryModal();
    ui.showMessage(`초기화 완료: ${activeEpisode.title}`);
    refresh();
  },
  onSelectItem: (itemId) => {
    store.selectItem(itemId);
    refresh();
  },
  onSelectEpisode: (episodeId) => {
    switchEpisode(episodeId, true);
  },
});

const renderer = createGameRenderer('game-canvas', episodeList, {
  isHotspotEnabled: (hotspot, snapshot) => canActivateHotspot(hotspot, snapshot).ok,
  onHotspotPressed: (hotspot) => {
    renderer.playSfx('click');
    const snapshot = store.getSnapshot();
    const check = canActivateHotspot(hotspot, snapshot);
    if (!check.ok) {
      renderer.playSfx('error');
      ui.showMessage(check.reason ?? '아직 실행할 수 없습니다.');
      return;
    }

    handleHotspot(hotspot);
  },
});

const findPuzzle = (puzzleId: string): PuzzleDef | undefined =>
  activeEpisode.puzzles.find((puzzle) => puzzle.id === puzzleId);

const evaluateObjectiveRule = (rule: ObjectiveRule): boolean => {
  const snapshot = store.getSnapshot();

  switch (rule.type) {
    case 'flag_true':
      return snapshot.flags[rule.flag] === true;
    case 'has_item':
      return snapshot.inventory.includes(rule.itemId);
    case 'puzzle_solved':
      return snapshot.solvedPuzzles.includes(rule.puzzleId);
    case 'scene_visited':
      return snapshot.visitedScenes.includes(rule.sceneId);
    default:
      return false;
  }
};

const buildObjectiveViews = (): ObjectiveView[] => {
  const objectives = activeEpisode.objectives ?? [];
  return objectives.map((objective) => ({
    id: objective.id,
    text: objective.text,
    done: objective.allOf.every((rule) => evaluateObjectiveRule(rule)),
  }));
};

const maybePlaySceneStory = (): boolean => {
  const snapshot = store.getSnapshot();
  if (snapshot.sceneId === lastSceneId) {
    return false;
  }

  lastSceneId = snapshot.sceneId;

  const lines = activeEpisode.sceneStories?.[snapshot.sceneId] ?? [];
  if (lines.length === 0) {
    return false;
  }

  const sceneStoryKey = `scene:${activeEpisode.id}:${snapshot.sceneId}`;
  if (store.hasSeenStory(sceneStoryKey)) {
    return false;
  }

  store.markStorySeen(sceneStoryKey);
  persistSave(store.toSave());

  ui.openStoryModal({
    lines,
    onFinish: () => {
      ui.showMessage(`${snapshot.sceneId} 구역 스토리를 확인했습니다.`);
      refresh();
    },
  });
  return true;
};

const maybePlayEndingStory = (): void => {
  const snapshot = store.getSnapshot();
  if (snapshot.flags.game_complete !== true || completionAnnounced) {
    return;
  }

  completionAnnounced = true;

  const endingKey = `ending:${activeEpisode.id}`;
  const endingLines = activeEpisode.endingStory ?? [];

  if (!store.hasSeenStory(endingKey) && endingLines.length > 0) {
    store.markStorySeen(endingKey);
    persistSave(store.toSave());
    ui.openStoryModal({
      lines: endingLines,
      onFinish: () => {
        renderer.playSfx('complete');
        ui.showMessage(`${activeEpisode.title} 완료!`);
        refresh();
      },
    });
  } else {
    renderer.playSfx('complete');
    ui.showMessage(`${activeEpisode.title} 완료!`);
  }
};

const unlockNextEpisodeIfNeeded = (): void => {
  const snapshot = store.getSnapshot();
  if (snapshot.flags.game_complete !== true) {
    return;
  }

  const currentIndex = episodeList.findIndex((episode) => episode.id === activeEpisode.id);
  const nextEpisode = currentIndex >= 0 ? episodeList[currentIndex + 1] : undefined;
  if (!nextEpisode) {
    return;
  }

  if (!unlockedEpisodeIds.includes(nextEpisode.id)) {
    unlockedEpisodeIds = [...unlockedEpisodeIds, nextEpisode.id];
    persistUnlockedEpisodes(unlockedEpisodeIds);
    ui.showMessage(`${nextEpisode.title} 해금! 에피소드 탭에서 선택하세요.`);
  }
};

const applyPuzzleSuccess = (puzzle: PuzzleDef, rewardItemId?: string): void => {
  const solvedNow = store.solvePuzzle(puzzle.id);
  if (!solvedNow) {
    return;
  }

  puzzle.successSetFlags.forEach((flag) => {
    store.setFlag(flag, true);
  });

  if (rewardItemId) {
    const added = store.addItem(rewardItemId);
    if (added) {
      ui.showMessage(`새 아이템 획득: ${rewardItemId}`);
    }
  }
};

const openPuzzle = (puzzle: PuzzleDef): void => {
  ui.openPuzzleModal({
    puzzle,
    inventory: store.getSnapshot().inventory,
    usedHints: store.getHintUsage(puzzle.id),
    onHint: () => {
      const next = store.incrementHintUsage(puzzle.id);
      refresh();
      return puzzle.hints[next - 1] ?? null;
    },
    onSubmit: (answer) => {
      const result = validatePuzzleAttempt(puzzle, answer);
      if (result.success) {
        renderer.playSfx('success');
        applyPuzzleSuccess(puzzle, result.rewardItemId);
        refresh();
      } else {
        renderer.playSfx('error');
      }

      return result;
    },
    onClose: () => {
      ui.showMessage('퍼즐 창을 닫았습니다.');
      refresh();
    },
  });
};

const handleUseItemAction = (hotspot: HotspotDef): void => {
  if (hotspot.action.type !== 'use_item') {
    return;
  }

  const selected = store.getSelectedItem();
  if (selected !== hotspot.action.requiredItemId) {
    renderer.playSfx('error');
    ui.showMessage(`선택한 아이템이 다릅니다. 필요한 아이템: ${hotspot.action.requiredItemId}`);
    return;
  }

  renderer.playSfx('success');
  store.setFlag(hotspot.action.successFlag, true);
  store.removeItem(hotspot.action.requiredItemId);
  store.selectItem(null);
  ui.showMessage('핵심 장치를 연결했습니다.');
};

const handleHotspot = (hotspot: HotspotDef): void => {
  const { action } = hotspot;

  switch (action.type) {
    case 'goto': {
      const moved = store.gotoScene(action.sceneId);
      ui.showMessage(moved ? `씬 이동: ${action.sceneId}` : '씬 이동에 실패했습니다.');
      break;
    }
    case 'pickup': {
      const added = store.addItem(action.itemId);
      ui.showMessage(added ? `아이템 획득: ${action.itemId}` : `이미 보유 중: ${action.itemId}`);
      break;
    }
    case 'use_item': {
      handleUseItemAction(hotspot);
      break;
    }
    case 'open_puzzle': {
      const puzzle = findPuzzle(action.puzzleId);
      if (!puzzle) {
        ui.showMessage('퍼즐 데이터를 찾지 못했습니다.');
        break;
      }

      if (store.isPuzzleSolved(puzzle.id)) {
        ui.showMessage('이미 해결한 퍼즐입니다.');
        break;
      }

      openPuzzle(puzzle);
      break;
    }
    default:
      ui.showMessage('정의되지 않은 행동입니다.');
      break;
  }

  refresh();
};

const switchEpisode = (episodeId: string, fromUserAction: boolean): void => {
  const nextEpisode = getEpisodeById(episodeId);
  if (!nextEpisode) {
    ui.showMessage('에피소드 데이터를 찾을 수 없습니다.');
    return;
  }

  if (!unlockedEpisodeIds.includes(nextEpisode.id)) {
    renderer.playSfx('error');
    if (fromUserAction) {
      ui.showMessage('잠긴 에피소드입니다. 이전 에피소드를 완료하세요.');
    }
    return;
  }

  persistSave(store.toSave());

  activeEpisode = nextEpisode;
  setLastEpisodeId(activeEpisode.id);

  store = new GameStore(activeEpisode);
  const saved = loadSave(activeEpisode.id);
  if (saved) {
    store.hydrate(saved);
  }

  completionAnnounced = false;
  lastSceneId = null;
  ui.closePuzzleModal();
  ui.closeStoryModal();

  if (fromUserAction) {
    ui.showMessage(`에피소드 전환: ${activeEpisode.title}`);
  }

  refresh();
};

const refresh = (): void => {
  const snapshot = store.getSnapshot();
  renderer.update(activeEpisode, snapshot);
  ui.render(snapshot, activeEpisode, episodeList, unlockedEpisodeIds, buildObjectiveViews());
  persistSave(store.toSave());

  unlockNextEpisodeIfNeeded();
  const sceneStoryPlayed = maybePlaySceneStory();
  if (!sceneStoryPlayed) {
    maybePlayEndingStory();
  }
};

refresh();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      ui.showMessage('서비스워커 등록에 실패했습니다.');
    });
  });
}

window.addEventListener('beforeunload', () => {
  renderer.destroy();
});
