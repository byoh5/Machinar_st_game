import type { HotspotDef } from './types';
import type { RuntimeState } from './store';

export interface HotspotCheckResult {
  ok: boolean;
  reason?: string;
}

export const canActivateHotspot = (
  hotspot: HotspotDef,
  snapshot: RuntimeState,
): HotspotCheckResult => {
  if (hotspot.requiredFlag && snapshot.flags[hotspot.requiredFlag] !== true) {
    return {
      ok: false,
      reason: hotspot.blockedText ?? '아직 조건이 맞지 않습니다.',
    };
  }

  if (hotspot.requiredItemId && !snapshot.inventory.includes(hotspot.requiredItemId)) {
    return {
      ok: false,
      reason: hotspot.blockedText ?? `필요한 아이템: ${hotspot.requiredItemId}`,
    };
  }

  return { ok: true };
};
