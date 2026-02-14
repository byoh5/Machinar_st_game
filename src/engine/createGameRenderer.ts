import Phaser from 'phaser';
import { PlayScene } from '../scenes/PlayScene';
import type { EpisodeManifest, HotspotDef } from '../core/types';
import type { RuntimeState } from '../core/store';

interface RendererHooks {
  onHotspotPressed: (hotspot: HotspotDef) => void;
  isHotspotEnabled: (hotspot: HotspotDef, snapshot: RuntimeState) => boolean;
}

export interface GameRenderer {
  update: (episode: EpisodeManifest, snapshot: RuntimeState) => void;
  playSfx: (eventName: 'click' | 'success' | 'error' | 'complete') => void;
  destroy: () => void;
}

export const createGameRenderer = (
  parentElementId: string,
  episodes: EpisodeManifest[],
  hooks: RendererHooks,
): GameRenderer => {
  const playScene = new PlayScene(episodes, {
    onHotspotPressed: hooks.onHotspotPressed,
    isHotspotEnabled: hooks.isHotspotEnabled,
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentElementId,
    scene: [playScene],
    backgroundColor: '#101820',
    width: 960,
    height: 540,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
  });

  return {
    update: (episode: EpisodeManifest, snapshot: RuntimeState) => {
      playScene.setWorld(episode, snapshot);
    },
    playSfx: (eventName) => {
      playScene.playSfx(eventName);
    },
    destroy: () => {
      game.destroy(true);
    },
  };
};
