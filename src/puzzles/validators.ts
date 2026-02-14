import type { ItemId, PuzzleDef } from '../core/types';

export interface PuzzleValidationResult {
  success: boolean;
  message: string;
  rewardItemId?: ItemId;
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const isEqualArray = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const validateSequenceLike = (
  puzzle: PuzzleDef,
  answer: unknown,
  label: string,
): PuzzleValidationResult => {
  const expected = asStringArray(puzzle.config.correctSequence);
  const input = asStringArray((answer as { sequence?: unknown })?.sequence);

  if (expected.length === 0) {
    return { success: false, message: `${label} 퍼즐 설정이 비어 있습니다.` };
  }

  if (isEqualArray(input, expected)) {
    return { success: true, message: `${label} 퍼즐을 해결했습니다.` };
  }

  return { success: false, message: `순서가 맞지 않습니다. 다시 시도하세요.` };
};

const validateInventoryCombine = (puzzle: PuzzleDef, answer: unknown): PuzzleValidationResult => {
  const requiredItems = asStringArray(puzzle.config.requiredItems).sort();
  const selectedItems = asStringArray((answer as { items?: unknown })?.items).sort();
  const resultItemId = typeof puzzle.config.resultItemId === 'string' ? puzzle.config.resultItemId : undefined;

  if (requiredItems.length === 0 || !resultItemId) {
    return { success: false, message: '조합 퍼즐 설정이 올바르지 않습니다.' };
  }

  if (isEqualArray(requiredItems, selectedItems)) {
    return {
      success: true,
      message: `아이템 조합 성공: ${resultItemId}`,
      rewardItemId: resultItemId,
    };
  }

  return { success: false, message: '조합이 맞지 않습니다.' };
};

const validateTimedSwitch = (puzzle: PuzzleDef, answer: unknown): PuzzleValidationResult => {
  const targetClicks =
    typeof puzzle.config.targetClicks === 'number' && puzzle.config.targetClicks > 0
      ? puzzle.config.targetClicks
      : 1;
  const windowMs =
    typeof puzzle.config.windowMs === 'number' && puzzle.config.windowMs > 0
      ? puzzle.config.windowMs
      : 3000;

  const clicks =
    typeof (answer as { clicks?: unknown })?.clicks === 'number'
      ? (answer as { clicks: number }).clicks
      : 0;
  const elapsedMs =
    typeof (answer as { elapsedMs?: unknown })?.elapsedMs === 'number'
      ? (answer as { elapsedMs: number }).elapsedMs
      : Number.POSITIVE_INFINITY;

  if (clicks >= targetClicks && elapsedMs <= windowMs) {
    return { success: true, message: '스위치 타이밍 퍼즐 성공!' };
  }

  return {
    success: false,
    message: `시간 내 ${targetClicks}회 클릭이 필요합니다. (${Math.ceil(windowMs / 1000)}초 제한)`,
  };
};

const validateLogicGrid = (puzzle: PuzzleDef, answer: unknown): PuzzleValidationResult => {
  const correctIndex =
    typeof puzzle.config.correctIndex === 'number' ? puzzle.config.correctIndex : Number.NaN;
  const selectedIndex =
    typeof (answer as { selectedIndex?: unknown })?.selectedIndex === 'number'
      ? (answer as { selectedIndex: number }).selectedIndex
      : Number.NaN;

  if (!Number.isFinite(correctIndex)) {
    return { success: false, message: '논리 퍼즐 설정이 올바르지 않습니다.' };
  }

  if (selectedIndex === correctIndex) {
    return { success: true, message: '논리 퍼즐 정답입니다.' };
  }

  return { success: false, message: '정답이 아닙니다.' };
};

export const validatePuzzleAttempt = (
  puzzle: PuzzleDef,
  answer: unknown,
): PuzzleValidationResult => {
  switch (puzzle.type) {
    case 'sequence':
      return validateSequenceLike(puzzle, answer, '순서');
    case 'pattern_lock':
      return validateSequenceLike(puzzle, answer, '패턴');
    case 'inventory_combine':
      return validateInventoryCombine(puzzle, answer);
    case 'timed_switch':
      return validateTimedSwitch(puzzle, answer);
    case 'logic_grid':
      return validateLogicGrid(puzzle, answer);
    default:
      return { success: false, message: '알 수 없는 퍼즐 타입입니다.' };
  }
};
