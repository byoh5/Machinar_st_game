import type { ItemId } from '../core/types';

export interface ItemMeta {
  label: string;
  icon: string;
}

const ITEM_META: Record<string, ItemMeta> = {
  wire: {
    label: '전선',
    icon: 'assets/items/wire.svg',
  },
  battery: {
    label: '배터리',
    icon: 'assets/items/battery.svg',
  },
  power_core: {
    label: '전력 코어',
    icon: 'assets/items/power_core.svg',
  },
  small_gear: {
    label: '작은 기어',
    icon: 'assets/items/small_gear.svg',
  },
  oil_can: {
    label: '오일 캔',
    icon: 'assets/items/oil_can.svg',
  },
  lubricated_rotor: {
    label: '윤활 로터',
    icon: 'assets/items/lubricated_rotor.svg',
  },
};

const toFallbackLabel = (itemId: string): string => itemId.replaceAll('_', ' ');

export const getItemMeta = (itemId: ItemId): ItemMeta => {
  const meta = ITEM_META[itemId];
  if (meta) {
    return meta;
  }

  return {
    label: toFallbackLabel(itemId),
    icon: '',
  };
};
