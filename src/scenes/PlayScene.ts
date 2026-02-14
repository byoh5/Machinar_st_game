import Phaser from 'phaser';
import type { EpisodeManifest, HotspotDef, SceneDef } from '../core/types';
import type { RuntimeState } from '../core/store';

interface PlaySceneHooks {
  onHotspotPressed: (hotspot: HotspotDef) => void;
  isHotspotEnabled: (hotspot: HotspotDef, snapshot: RuntimeState) => boolean;
}

type SfxEventName = 'click' | 'success' | 'error' | 'complete';

const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;

const EVENT_SFX: Record<SfxEventName, string> = {
  click: 'sfx_click',
  success: 'sfx_success',
  error: 'sfx_error',
  complete: 'sfx_complete',
};

const EVENT_SFX_VOLUME: Record<SfxEventName, number> = {
  click: 0.5,
  success: 0.7,
  error: 0.55,
  complete: 0.75,
};

const isHexColor = (value: string): boolean => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const parseColor = (hex: string): number => {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  return Number.parseInt(normalized, 16);
};

export class PlayScene extends Phaser.Scene {
  private readonly hooks: PlaySceneHooks;
  private readonly bootstrapEpisodes: EpisodeManifest[];

  private isReady = false;
  private episode: EpisodeManifest | null = null;
  private snapshot: RuntimeState | null = null;

  private background!: Phaser.GameObjects.Rectangle;
  private backgroundImage: Phaser.GameObjects.Image | null = null;
  private titleLabel!: Phaser.GameObjects.Text;
  private descriptionLabel!: Phaser.GameObjects.Text;

  private actor!: Phaser.GameObjects.Container;

  private hotspotObjects: Phaser.GameObjects.GameObject[] = [];
  private hotspotTweens: Phaser.Tweens.Tween[] = [];
  private backgroundKeyBySceneId = new Map<string, string>();
  private ambientKeyByPath = new Map<string, string>();
  private currentAmbientKey: string | null = null;
  private lastRenderedSceneId: string | null = null;

  constructor(episodes: EpisodeManifest[], hooks: PlaySceneHooks) {
    super('play');
    this.bootstrapEpisodes = episodes;
    this.hooks = hooks;
  }

  preload(): void {
    this.bootstrapEpisodes.forEach((episode) => {
      episode.scenes.forEach((scene) => {
        if (!isHexColor(scene.background) && !this.backgroundKeyBySceneId.has(scene.id)) {
          const key = `bg:${scene.id}`;
          this.backgroundKeyBySceneId.set(scene.id, key);
          this.load.image(key, scene.background);
        }

        if (scene.ambientSfx && !this.ambientKeyByPath.has(scene.ambientSfx)) {
          const ambientKey = `amb:${this.ambientKeyByPath.size}`;
          this.ambientKeyByPath.set(scene.ambientSfx, ambientKey);
          this.load.audio(ambientKey, scene.ambientSfx);
        }
      });
    });

    this.load.audio(EVENT_SFX.click, 'assets/sfx/ui_click.wav');
    this.load.audio(EVENT_SFX.success, 'assets/sfx/puzzle_success.wav');
    this.load.audio(EVENT_SFX.error, 'assets/sfx/puzzle_error.wav');
    this.load.audio(EVENT_SFX.complete, 'assets/sfx/episode_complete.wav');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101820');

    this.background = this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x273746);
    this.background.setOrigin(0.5, 0.5);
    this.background.setDepth(0);

    this.titleLabel = this.add.text(24, 16, '', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#f6f4d2',
    });
    this.titleLabel.setDepth(12);

    this.descriptionLabel = this.add.text(24, 52, '', {
      fontFamily: 'Courier New',
      fontSize: '16px',
      color: '#dad6b9',
      wordWrap: { width: BASE_WIDTH - 48 },
    });
    this.descriptionLabel.setDepth(12);

    this.actor = this.createActor();

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopAmbient();
    });

    this.isReady = true;
    this.renderScene();
  }

  setWorld(episode: EpisodeManifest, snapshot: RuntimeState): void {
    this.episode = episode;
    this.snapshot = snapshot;

    if (this.isReady) {
      this.renderScene();
    }
  }

  playSfx(eventName: SfxEventName): void {
    const key = EVENT_SFX[eventName];
    if (!this.sound || !this.cache.audio.exists(key)) {
      return;
    }

    this.sound.play(key, {
      volume: EVENT_SFX_VOLUME[eventName],
      rate: 1,
    });
  }

  private createActor(): Phaser.GameObjects.Container {
    const shadow = this.add.ellipse(0, 10, 34, 12, 0x000000, 0.35);
    const body = this.add.rectangle(0, -3, 24, 34, 0xc4d1dd);
    const head = this.add.circle(0, -26, 14, 0xd9e6ef);
    const eyeLeft = this.add.circle(-5, -28, 2, 0x21364c);
    const eyeRight = this.add.circle(5, -28, 2, 0x21364c);

    const actor = this.add.container(120, 455, [shadow, body, head, eyeLeft, eyeRight]);
    actor.setDepth(32);

    this.tweens.add({
      targets: actor,
      y: actor.y - 3,
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
    });

    return actor;
  }

  private animateTapFeedback(x: number, y: number): void {
    const ring = this.add.circle(x, y, 8, 0xf7ede2, 0.35).setDepth(40);
    this.tweens.add({
      targets: ring,
      radius: 34,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private moveActorToHotspot(hotspot: HotspotDef, onArrive: () => void): void {
    const targetX = Phaser.Math.Clamp(hotspot.x + hotspot.w / 2, 90, BASE_WIDTH - 90);
    const targetY = Phaser.Math.Clamp(hotspot.y + hotspot.h + 12, 330, 475);

    this.tweens.killTweensOf(this.actor);
    this.tweens.add({
      targets: this.actor,
      x: targetX,
      y: targetY,
      duration: 170,
      ease: 'Quad.easeOut',
      onComplete: onArrive,
    });
  }

  private stopAmbient(): void {
    if (this.currentAmbientKey) {
      this.sound.stopByKey(this.currentAmbientKey);
      this.currentAmbientKey = null;
    }
  }

  private applyAmbient(sceneDef: SceneDef): void {
    const nextAmbientKey = sceneDef.ambientSfx ? this.ambientKeyByPath.get(sceneDef.ambientSfx) ?? null : null;

    if (nextAmbientKey === this.currentAmbientKey) {
      return;
    }

    this.stopAmbient();

    if (nextAmbientKey) {
      this.currentAmbientKey = nextAmbientKey;
      this.sound.play(nextAmbientKey, {
        loop: true,
        volume: 0.12,
      });
    }
  }

  private applyBackground(sceneDef: SceneDef): void {
    if (isHexColor(sceneDef.background)) {
      this.background.setVisible(true);
      this.background.setFillStyle(parseColor(sceneDef.background));

      if (this.backgroundImage) {
        this.backgroundImage.setVisible(false);
      }

      return;
    }

    const textureKey = this.backgroundKeyBySceneId.get(sceneDef.id);
    if (!textureKey || !this.textures.exists(textureKey)) {
      this.background.setVisible(true);
      this.background.setFillStyle(0x273746);
      if (this.backgroundImage) {
        this.backgroundImage.setVisible(false);
      }
      return;
    }

    if (!this.backgroundImage) {
      this.backgroundImage = this.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, textureKey);
      this.backgroundImage.setDepth(1);
    } else {
      this.backgroundImage.setTexture(textureKey);
      this.backgroundImage.setVisible(true);
    }

    this.backgroundImage.setDisplaySize(BASE_WIDTH, BASE_HEIGHT);
    this.background.setVisible(false);
  }

  private findScene(sceneId: string): SceneDef | undefined {
    return this.episode?.scenes.find((scene) => scene.id === sceneId);
  }

  private clearHotspots(): void {
    this.hotspotTweens.forEach((tween) => tween.stop());
    this.hotspotTweens = [];

    this.hotspotObjects.forEach((object) => object.destroy());
    this.hotspotObjects = [];
  }

  private renderScene(): void {
    if (!this.episode || !this.snapshot || !this.isReady) {
      return;
    }

    const sceneDef = this.findScene(this.snapshot.sceneId);
    if (!sceneDef) {
      return;
    }

    const sceneChanged = this.lastRenderedSceneId !== null && this.lastRenderedSceneId !== sceneDef.id;

    this.clearHotspots();
    this.applyBackground(sceneDef);
    this.applyAmbient(sceneDef);

    this.titleLabel.setText(sceneDef.title);
    this.descriptionLabel.setText(sceneDef.description);

    sceneDef.hotspots.forEach((hotspot, index) => {
      const enabled = this.hooks.isHotspotEnabled(hotspot, this.snapshot as RuntimeState);
      const baseColor = enabled ? 0xf4a259 : 0x5f6f72;
      const labelColor = enabled ? '#122029' : '#d7d7d7';

      const area = this.add.rectangle(
        hotspot.x + hotspot.w / 2,
        hotspot.y + hotspot.h / 2,
        hotspot.w,
        hotspot.h,
        baseColor,
        enabled ? 0.24 : 0.15,
      );
      area.setDepth(20);
      area.setStrokeStyle(2, enabled ? 0xf7ede2 : 0x9fa6a8, enabled ? 0.8 : 0.4);

      const label = this.add.text(hotspot.x + 10, hotspot.y + hotspot.h / 2 - 10, hotspot.label, {
        fontFamily: 'Courier New',
        fontSize: '16px',
        color: labelColor,
        wordWrap: { width: hotspot.w - 14 },
      });
      label.setDepth(21);

      if (enabled) {
        const pulse = this.tweens.add({
          targets: area,
          alpha: { from: 0.19, to: 0.31 },
          duration: 900 + index * 60,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.hotspotTweens.push(pulse);

        area.setInteractive({ cursor: 'pointer' });
        area.on('pointerover', () => {
          area.setScale(1.02);
          area.setStrokeStyle(2, 0xfff3dc, 0.95);
        });
        area.on('pointerout', () => {
          area.setScale(1);
          area.setStrokeStyle(2, 0xf7ede2, 0.8);
        });
        area.on('pointerdown', () => {
          const centerX = hotspot.x + hotspot.w / 2;
          const centerY = hotspot.y + hotspot.h / 2;
          this.animateTapFeedback(centerX, centerY);
          this.moveActorToHotspot(hotspot, () => {
            this.hooks.onHotspotPressed(hotspot);
          });
        });
      }

      this.hotspotObjects.push(area, label);
    });

    if (sceneChanged) {
      this.cameras.main.fadeIn(220, 0, 0, 0);
    }

    this.lastRenderedSceneId = sceneDef.id;
  }
}
