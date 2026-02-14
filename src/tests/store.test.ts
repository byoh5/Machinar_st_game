import { describe, expect, it } from 'vitest';
import { episode01 } from '../content/episodes/episode01';
import { episode02 } from '../content/episodes/episode02';
import { migrateSave } from '../core/save';
import { GameStore } from '../core/store';

describe('GameStore', () => {
  it('adds inventory and toggles selected item', () => {
    const store = new GameStore(episode01);

    expect(store.addItem('wire')).toBe(true);
    expect(store.addItem('wire')).toBe(false);

    store.selectItem('wire');
    expect(store.getSelectedItem()).toBe('wire');

    store.selectItem('wire');
    expect(store.getSelectedItem()).toBeNull();
  });

  it('solves puzzles and persists save payload', () => {
    const store = new GameStore(episode01);
    store.solvePuzzle('p_seq_power');
    store.setFlag('power_restored', true);

    const save = store.toSave();
    expect(save.solvedPuzzles).toContain('p_seq_power');
    expect(save.flags.power_restored).toBe(true);

    const migrated = migrateSave(save);
    expect(migrated?.episodeId).toBe('episode_01');
  });

  it('keeps scene validation scoped per episode', () => {
    const store1 = new GameStore(episode01);
    const store2 = new GameStore(episode02);

    expect(store1.gotoScene('steam_square')).toBe(false);
    expect(store2.gotoScene('steam_square')).toBe(true);
  });
});
