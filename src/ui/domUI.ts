import type { EpisodeManifest, ItemId, PuzzleDef, StoryLine } from '../core/types';
import type { RuntimeState } from '../core/store';
import { getItemMeta } from '../content/itemCatalog';

interface UIHandlers {
  onSave: () => void;
  onLoad: () => void;
  onReset: () => void;
  onSelectItem: (itemId: ItemId | null) => void;
  onSelectEpisode: (episodeId: string) => void;
}

export interface ObjectiveView {
  id: string;
  text: string;
  done: boolean;
}

export interface StoryModalOptions {
  lines: StoryLine[];
  onFinish: () => void;
}

export interface PuzzleModalHandlers {
  puzzle: PuzzleDef;
  inventory: ItemId[];
  usedHints: number;
  onHint: () => string | null;
  onSubmit: (answer: unknown) => { success: boolean; message: string };
  onClose: () => void;
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export class DOMUI {
  private readonly root: HTMLElement;
  private readonly handlers: UIHandlers;

  private readonly sceneTitleEl: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly inventoryEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly episodeListEl: HTMLElement;
  private readonly objectiveListEl: HTMLElement;
  private readonly objectiveProgressEl: HTMLElement;

  private readonly puzzleModalEl: HTMLDivElement;
  private readonly puzzleTitleEl: HTMLElement;
  private readonly puzzlePromptEl: HTMLElement;
  private readonly puzzleBodyEl: HTMLElement;
  private readonly puzzleHintEl: HTMLElement;
  private readonly puzzleFeedbackEl: HTMLElement;

  private readonly storyModalEl: HTMLDivElement;
  private readonly storySpeakerEl: HTMLElement;
  private readonly storyTextEl: HTMLElement;
  private readonly storyNextBtn: HTMLButtonElement;
  private readonly storySkipBtn: HTMLButtonElement;

  private cleanupPuzzleModal: (() => void) | null = null;
  private cleanupStoryModal: (() => void) | null = null;

  constructor(root: HTMLElement, handlers: UIHandlers) {
    this.root = root;
    this.handlers = handlers;

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="hud">
          <div class="hud-main">
            <h1>Machinar Story Build</h1>
            <p id="scene-title" class="scene-title"></p>
          </div>
          <div class="hud-controls">
            <button id="btn-save" class="ctrl-btn" type="button">Save</button>
            <button id="btn-load" class="ctrl-btn" type="button">Load</button>
            <button id="btn-reset" class="ctrl-btn danger" type="button">Reset</button>
          </div>
        </header>

        <div class="message-wrap">
          <p id="message-box">게임을 시작합니다.</p>
        </div>

        <section class="episode-wrap">
          <h2>Episodes</h2>
          <div id="episode-list" class="episode-list"></div>
        </section>

        <main class="game-area">
          <div id="game-canvas" class="game-canvas" aria-label="game canvas"></div>
        </main>

        <section class="objective-wrap">
          <h2>Objectives</h2>
          <p id="objective-progress" class="objective-progress"></p>
          <div id="objective-list" class="objective-list"></div>
        </section>

        <section class="inventory-wrap">
          <h2>Inventory</h2>
          <div id="inventory-list" class="inventory-list"></div>
        </section>

        <section class="status-wrap">
          <h2>Progress</h2>
          <p id="status-text"></p>
        </section>
      </div>

      <div id="puzzle-modal" class="modal hidden" role="dialog" aria-modal="true">
        <div class="modal-card">
          <div class="modal-header">
            <h3 id="puzzle-title"></h3>
            <button id="puzzle-close" class="ctrl-btn" type="button">닫기</button>
          </div>
          <p id="puzzle-prompt"></p>
          <div id="puzzle-body" class="puzzle-body"></div>
          <div class="modal-actions">
            <button id="btn-hint" class="ctrl-btn" type="button">힌트 보기</button>
          </div>
          <p id="puzzle-hint" class="hint-text"></p>
          <p id="puzzle-feedback" class="feedback-text"></p>
        </div>
      </div>

      <div id="story-modal" class="modal hidden story-modal" role="dialog" aria-modal="true">
        <div class="modal-card story-card">
          <div class="story-top">
            <p id="story-speaker" class="story-speaker"></p>
            <button id="story-skip" class="ctrl-btn" type="button">건너뛰기</button>
          </div>
          <p id="story-text" class="story-text"></p>
          <div class="story-actions">
            <button id="story-next" class="ctrl-btn" type="button">다음</button>
          </div>
        </div>
      </div>
    `;

    this.sceneTitleEl = this.getById('scene-title');
    this.messageEl = this.getById('message-box');
    this.inventoryEl = this.getById('inventory-list');
    this.statusEl = this.getById('status-text');
    this.episodeListEl = this.getById('episode-list');
    this.objectiveListEl = this.getById('objective-list');
    this.objectiveProgressEl = this.getById('objective-progress');

    this.puzzleModalEl = this.getById('puzzle-modal') as HTMLDivElement;
    this.puzzleTitleEl = this.getById('puzzle-title');
    this.puzzlePromptEl = this.getById('puzzle-prompt');
    this.puzzleBodyEl = this.getById('puzzle-body');
    this.puzzleHintEl = this.getById('puzzle-hint');
    this.puzzleFeedbackEl = this.getById('puzzle-feedback');

    this.storyModalEl = this.getById('story-modal') as HTMLDivElement;
    this.storySpeakerEl = this.getById('story-speaker');
    this.storyTextEl = this.getById('story-text');
    this.storyNextBtn = this.getById('story-next') as HTMLButtonElement;
    this.storySkipBtn = this.getById('story-skip') as HTMLButtonElement;

    this.bindStaticEvents();
  }

  private getById(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!element) {
      throw new Error(`Required element missing: ${id}`);
    }

    return element;
  }

  private bindStaticEvents(): void {
    this.getById('btn-save').addEventListener('click', () => this.handlers.onSave());
    this.getById('btn-load').addEventListener('click', () => this.handlers.onLoad());
    this.getById('btn-reset').addEventListener('click', () => this.handlers.onReset());
  }

  render(
    snapshot: RuntimeState,
    episode: EpisodeManifest,
    allEpisodes: EpisodeManifest[],
    unlockedEpisodeIds: string[],
    objectives: ObjectiveView[],
  ): void {
    const currentScene = episode.scenes.find((scene) => scene.id === snapshot.sceneId);
    const solvedCount = snapshot.solvedPuzzles.length;
    const puzzleCount = episode.puzzles.length;

    this.sceneTitleEl.textContent = currentScene
      ? `${episode.title} - ${currentScene.title}`
      : `${episode.title} - scene missing`;

    this.statusEl.textContent = `씬: ${snapshot.sceneId} | 퍼즐: ${solvedCount}/${puzzleCount} | 아이템: ${snapshot.inventory.length}`;

    this.episodeListEl.innerHTML = '';
    allEpisodes.forEach((candidate) => {
      const unlocked = unlockedEpisodeIds.includes(candidate.id);
      const active = candidate.id === episode.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `episode-item ${active ? 'selected' : ''} ${unlocked ? '' : 'locked'}`.trim();
      button.textContent = unlocked ? candidate.title : `${candidate.title} (잠김)`;
      button.disabled = !unlocked;
      button.addEventListener('click', () => {
        this.handlers.onSelectEpisode(candidate.id);
      });
      this.episodeListEl.appendChild(button);
    });

    this.objectiveListEl.innerHTML = '';
    const completedObjectives = objectives.filter((objective) => objective.done).length;
    this.objectiveProgressEl.textContent = `${completedObjectives}/${objectives.length} 완료`;
    objectives.forEach((objective) => {
      const row = document.createElement('div');
      row.className = `objective-item ${objective.done ? 'done' : ''}`;
      row.textContent = `${objective.done ? '✓' : '○'} ${objective.text}`;
      this.objectiveListEl.appendChild(row);
    });

    this.inventoryEl.innerHTML = '';

    if (snapshot.inventory.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'inventory-empty';
      empty.textContent = '아이템이 없습니다.';
      this.inventoryEl.appendChild(empty);
      return;
    }

    snapshot.inventory.forEach((itemId) => {
      const itemMeta = getItemMeta(itemId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `inventory-item ${snapshot.selectedItemId === itemId ? 'selected' : ''}`;
      if (itemMeta.icon) {
        const icon = document.createElement('img');
        icon.className = 'inventory-icon';
        icon.src = itemMeta.icon;
        icon.alt = itemMeta.label;
        button.appendChild(icon);
      }

      const label = document.createElement('span');
      label.className = 'inventory-label';
      label.textContent = itemMeta.label;
      button.appendChild(label);
      button.addEventListener('click', () => {
        this.handlers.onSelectItem(itemId);
      });
      this.inventoryEl.appendChild(button);
    });

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'inventory-item clear';
    clearButton.textContent = '선택 해제';
    clearButton.addEventListener('click', () => {
      this.handlers.onSelectItem(null);
    });
    this.inventoryEl.appendChild(clearButton);
  }

  showMessage(message: string): void {
    this.messageEl.textContent = message;
  }

  openStoryModal(options: StoryModalOptions): void {
    this.closeStoryModal();

    const lines = [...options.lines];
    if (lines.length === 0) {
      options.onFinish();
      return;
    }

    this.storyModalEl.classList.remove('hidden');
    let index = 0;

    const renderLine = () => {
      const line = lines[index];
      this.storySpeakerEl.textContent = line.speaker;
      this.storyTextEl.textContent = line.text;
      this.storyNextBtn.textContent = index >= lines.length - 1 ? '완료' : '다음';
    };

    const finish = () => {
      options.onFinish();
      this.closeStoryModal();
    };

    const onNext = () => {
      if (index >= lines.length - 1) {
        finish();
        return;
      }

      index += 1;
      renderLine();
    };

    const onSkip = () => {
      finish();
    };

    this.storyNextBtn.addEventListener('click', onNext);
    this.storySkipBtn.addEventListener('click', onSkip);

    this.cleanupStoryModal = () => {
      this.storyNextBtn.removeEventListener('click', onNext);
      this.storySkipBtn.removeEventListener('click', onSkip);
    };

    renderLine();
  }

  closeStoryModal(): void {
    if (this.cleanupStoryModal) {
      this.cleanupStoryModal();
      this.cleanupStoryModal = null;
    }

    this.storyModalEl.classList.add('hidden');
    this.storySpeakerEl.textContent = '';
    this.storyTextEl.textContent = '';
  }

  openPuzzleModal(handlers: PuzzleModalHandlers): void {
    this.closePuzzleModal();

    const { puzzle } = handlers;
    this.puzzleTitleEl.textContent = puzzle.title;
    this.puzzlePromptEl.textContent = puzzle.prompt;
    this.puzzleHintEl.textContent = handlers.usedHints > 0 ? `힌트 ${handlers.usedHints}회 사용됨` : '';
    this.puzzleFeedbackEl.textContent = '';

    this.puzzleBodyEl.innerHTML = '';
    this.puzzleModalEl.classList.remove('hidden');

    const closeBtn = this.getById('puzzle-close');
    const hintBtn = this.getById('btn-hint');

    const onHint = () => {
      const hintText = handlers.onHint();
      this.puzzleHintEl.textContent = hintText ?? '모든 힌트를 이미 확인했습니다.';
    };

    hintBtn.addEventListener('click', onHint);

    const onClose = () => {
      handlers.onClose();
      this.closePuzzleModal();
    };

    closeBtn.addEventListener('click', onClose);

    const cleanupPuzzleBody = this.renderPuzzleBody(handlers);

    this.cleanupPuzzleModal = () => {
      cleanupPuzzleBody();
      closeBtn.removeEventListener('click', onClose);
      hintBtn.removeEventListener('click', onHint);
    };
  }

  closePuzzleModal(): void {
    if (this.cleanupPuzzleModal) {
      this.cleanupPuzzleModal();
      this.cleanupPuzzleModal = null;
    }

    this.puzzleModalEl.classList.add('hidden');
    this.puzzleBodyEl.innerHTML = '';
  }

  private renderPuzzleBody(handlers: PuzzleModalHandlers): () => void {
    switch (handlers.puzzle.type) {
      case 'sequence':
      case 'pattern_lock':
        return this.renderSequenceBody(handlers);
      case 'inventory_combine':
        return this.renderInventoryCombineBody(handlers);
      case 'timed_switch':
        return this.renderTimedSwitchBody(handlers);
      case 'logic_grid':
        return this.renderLogicGridBody(handlers);
      default:
        this.puzzleBodyEl.textContent = '지원되지 않는 퍼즐 타입입니다.';
        return () => undefined;
    }
  }

  private renderSequenceBody(handlers: PuzzleModalHandlers): () => void {
    const symbols = asStringArray(handlers.puzzle.config.symbols);
    const expectedLength = asStringArray(handlers.puzzle.config.correctSequence).length;
    const selected: string[] = [];

    const display = document.createElement('p');
    display.className = 'puzzle-display';

    const updateDisplay = () => {
      const value = selected.length > 0 ? selected.join(' -> ') : '(입력 대기 중)';
      display.textContent = `입력: ${value}`;
    };

    const controls = document.createElement('div');
    controls.className = 'puzzle-grid';

    symbols.forEach((symbol) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'puzzle-key';
      button.textContent = symbol;
      button.addEventListener('click', () => {
        if (selected.length < expectedLength) {
          selected.push(symbol);
          updateDisplay();
        }
      });
      controls.appendChild(button);
    });

    const actionRow = document.createElement('div');
    actionRow.className = 'puzzle-inline-actions';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'ctrl-btn';
    resetButton.textContent = '입력 초기화';
    resetButton.addEventListener('click', () => {
      selected.splice(0, selected.length);
      updateDisplay();
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'ctrl-btn';
    submitButton.textContent = '제출';
    submitButton.addEventListener('click', () => {
      const result = handlers.onSubmit({ sequence: [...selected] });
      this.puzzleFeedbackEl.textContent = result.message;
      if (result.success) {
        this.closePuzzleModal();
      }
    });

    updateDisplay();
    actionRow.append(resetButton, submitButton);
    this.puzzleBodyEl.append(display, controls, actionRow);

    return () => undefined;
  }

  private renderInventoryCombineBody(handlers: PuzzleModalHandlers): () => void {
    const selected = new Set<ItemId>();

    const list = document.createElement('div');
    list.className = 'puzzle-grid';

    handlers.inventory.forEach((itemId) => {
      const itemMeta = getItemMeta(itemId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'puzzle-key';
      if (itemMeta.icon) {
        const icon = document.createElement('img');
        icon.className = 'puzzle-item-icon';
        icon.src = itemMeta.icon;
        icon.alt = itemMeta.label;
        button.appendChild(icon);
      }

      const label = document.createElement('span');
      label.className = 'puzzle-item-label';
      label.textContent = itemMeta.label;
      button.appendChild(label);
      button.addEventListener('click', () => {
        if (selected.has(itemId)) {
          selected.delete(itemId);
          button.classList.remove('selected');
        } else {
          selected.add(itemId);
          button.classList.add('selected');
        }
      });

      list.appendChild(button);
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'ctrl-btn';
    submitButton.textContent = '조합 제출';
    submitButton.addEventListener('click', () => {
      const result = handlers.onSubmit({ items: [...selected] });
      this.puzzleFeedbackEl.textContent = result.message;
      if (result.success) {
        this.closePuzzleModal();
      }
    });

    this.puzzleBodyEl.append(list, submitButton);

    return () => undefined;
  }

  private renderTimedSwitchBody(handlers: PuzzleModalHandlers): () => void {
    const targetClicks =
      typeof handlers.puzzle.config.targetClicks === 'number' ? handlers.puzzle.config.targetClicks : 1;
    const windowMs = typeof handlers.puzzle.config.windowMs === 'number' ? handlers.puzzle.config.windowMs : 3000;

    const status = document.createElement('p');
    status.className = 'puzzle-display';

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'ctrl-btn';
    startButton.textContent = '타이머 시작';

    const switchButton = document.createElement('button');
    switchButton.type = 'button';
    switchButton.className = 'puzzle-key switch-btn';
    switchButton.textContent = '스위치';
    switchButton.disabled = true;

    let clicks = 0;
    let startedAt = 0;
    let intervalId: number | null = null;

    const stopTimer = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const updateStatus = (remainingMs?: number) => {
      const remaining = remainingMs ?? Math.max(windowMs - (Date.now() - startedAt), 0);
      status.textContent = `클릭 ${clicks}/${targetClicks} | 남은 시간 ${Math.ceil(remaining / 1000)}초`;
    };

    const finish = () => {
      stopTimer();
      switchButton.disabled = true;
      startButton.disabled = false;

      const elapsedMs = Date.now() - startedAt;
      const result = handlers.onSubmit({ clicks, elapsedMs });
      this.puzzleFeedbackEl.textContent = result.message;
      if (result.success) {
        this.closePuzzleModal();
      }
    };

    startButton.addEventListener('click', () => {
      clicks = 0;
      startedAt = Date.now();
      startButton.disabled = true;
      switchButton.disabled = false;
      updateStatus(windowMs);

      intervalId = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remainingMs = Math.max(windowMs - elapsed, 0);
        updateStatus(remainingMs);

        if (elapsed >= windowMs) {
          finish();
        }
      }, 100);
    });

    switchButton.addEventListener('click', () => {
      if (switchButton.disabled) {
        return;
      }

      clicks += 1;
      updateStatus();
    });

    this.puzzleBodyEl.append(status, startButton, switchButton);
    updateStatus(windowMs);

    return () => {
      stopTimer();
    };
  }

  private renderLogicGridBody(handlers: PuzzleModalHandlers): () => void {
    const options = asStringArray(handlers.puzzle.config.options);
    let selectedIndex = -1;

    const group = document.createElement('div');
    group.className = 'logic-options';

    options.forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'logic-option';
      optionButton.textContent = option;
      optionButton.addEventListener('click', () => {
        selectedIndex = index;
        group.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
          button.classList.remove('selected');
        });
        optionButton.classList.add('selected');
      });
      group.appendChild(optionButton);
    });

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'ctrl-btn';
    submitButton.textContent = '정답 제출';
    submitButton.addEventListener('click', () => {
      const result = handlers.onSubmit({ selectedIndex });
      this.puzzleFeedbackEl.textContent = result.message;
      if (result.success) {
        this.closePuzzleModal();
      }
    });

    this.puzzleBodyEl.append(group, submitButton);
    return () => undefined;
  }
}
