import { BrandPosition } from '../../shared/plan';

const BRAND_ENABLED_KEY = 'jtec_brand_tag_enabled';
const BRAND_CONTENT_KEY = 'jtec_brand_tag_content';
const BRAND_POSITION_KEY = 'jtec_brand_tag_position';

export interface StoredBrandTag {
  enabled: boolean;
  content: string;
  position: BrandPosition;
}

export function getStoredBrandTag(): StoredBrandTag {
  try {
    const enabled = localStorage.getItem(BRAND_ENABLED_KEY) === 'true';
    const content = (localStorage.getItem(BRAND_CONTENT_KEY) || '').slice(0, 30);
    const pos = localStorage.getItem(BRAND_POSITION_KEY) as BrandPosition;
    const position: BrandPosition = [
      'bottom_center',
      'bottom_left',
      'bottom_right',
      'top_center',
    ].includes(pos)
      ? pos
      : 'bottom_center';

    return { enabled, content, position };
  } catch {
    return { enabled: false, content: '', position: 'bottom_center' };
  }
}

export function saveStoredBrandTag(tag: StoredBrandTag): void {
  try {
    localStorage.setItem(BRAND_ENABLED_KEY, tag.enabled ? 'true' : 'false');
    localStorage.setItem(BRAND_CONTENT_KEY, tag.content.slice(0, 30));
    localStorage.setItem(BRAND_POSITION_KEY, tag.position);
  } catch {}
}
