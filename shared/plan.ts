export type CaptionSize = 'small' | 'medium' | 'large';
export type CaptionColor = 'white' | 'yellow' | 'black';
export type CaptionStyle = 'clean' | 'box' | 'outline';
export type VideoLook = 'none' | 'cinematic' | 'warm' | 'cool' | 'bw' | 'vivid';
export type VideoZoom = 'none' | 'slow_in' | 'slow_out';
export type BrandPosition = 'bottom_center' | 'bottom_left' | 'bottom_right' | 'top_center';

export interface PlanTextItem {
  id?: string;
  content: string;
  x: number; // 0.05 - 0.95 center fraction
  y: number; // 0.05 - 0.95 center fraction
  size: CaptionSize;
  color: CaptionColor;
  style: CaptionStyle;
  start: number; // seconds on final video
  end: number | null; // seconds on final video or null
  fade_in: number; // 0 - 3
}

export interface BrandTagConfig {
  content: string; // max 30 chars
  position: BrandPosition;
}

export interface TrimConfig {
  start: number;
  end: number;
}

export interface RenderPlan {
  texts: PlanTextItem[];
  brand?: BrandTagConfig;
  look: VideoLook;
  zoom: VideoZoom;
  speed: number;
  trim: TrimConfig;
  fade_in: number;
  fade_out: number;
  // Legacy single text compatibility
  text?: {
    content: string;
    position: 'top' | 'center' | 'bottom';
    size: CaptionSize;
    color: CaptionColor;
    fade_in: number;
  };
}

export const ALLOWED_SIZES: CaptionSize[] = ['small', 'medium', 'large'];
export const ALLOWED_COLORS: CaptionColor[] = ['white', 'yellow', 'black'];
export const ALLOWED_STYLES: CaptionStyle[] = ['clean', 'box', 'outline'];
export const ALLOWED_LOOKS: VideoLook[] = ['none', 'cinematic', 'warm', 'cool', 'bw', 'vivid'];
export const ALLOWED_ZOOMS: VideoZoom[] = ['none', 'slow_in', 'slow_out'];
export const ALLOWED_BRAND_POSITIONS: BrandPosition[] = [
  'bottom_center',
  'bottom_left',
  'bottom_right',
  'top_center',
];

export const DEFAULT_PLAN: RenderPlan = {
  texts: [],
  look: 'none',
  zoom: 'none',
  speed: 1,
  trim: {
    start: 0,
    end: 0,
  },
  fade_in: 0,
  fade_out: 0,
};

export function validateAndSanitizePlan(input: any): RenderPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Plan must be a valid JSON object.');
  }

  // Strict whitelist of top-level keys
  const allowedTopKeys = new Set([
    'texts',
    'brand',
    'look',
    'zoom',
    'speed',
    'trim',
    'fade_in',
    'fade_out',
    'text', // legacy
  ]);

  for (const key of Object.keys(input)) {
    if (!allowedTopKeys.has(key)) {
      throw new Error(`Unexpected plan property: "${key}".`);
    }
  }

  // Validate look
  const look = input.look ?? 'none';
  if (!ALLOWED_LOOKS.includes(look)) {
    throw new Error(`Invalid look: "${look}". Must be one of: ${ALLOWED_LOOKS.join(', ')}.`);
  }

  // Validate zoom
  const zoom = input.zoom ?? 'none';
  if (!ALLOWED_ZOOMS.includes(zoom)) {
    throw new Error(`Invalid zoom: "${zoom}". Must be one of: ${ALLOWED_ZOOMS.join(', ')}.`);
  }

  // Validate speed: clamped 0.5 to 2
  let speed = typeof input.speed === 'number' ? input.speed : 1;
  if (isNaN(speed)) {
    throw new Error('Speed must be a valid number.');
  }
  speed = Math.min(Math.max(Number(speed.toFixed(2)), 0.5), 2);

  // Validate fade_in & fade_out: clamped 0 to 3
  let fadeIn = typeof input.fade_in === 'number' ? input.fade_in : 0;
  if (isNaN(fadeIn)) throw new Error('fade_in must be a number.');
  fadeIn = Math.min(Math.max(Math.round(fadeIn), 0), 3);

  let fadeOut = typeof input.fade_out === 'number' ? input.fade_out : 0;
  if (isNaN(fadeOut)) throw new Error('fade_out must be a number.');
  fadeOut = Math.min(Math.max(Math.round(fadeOut), 0), 3);

  // Validate trim
  let trim: TrimConfig = { start: 0, end: 0 };
  if (input.trim !== undefined) {
    if (!input.trim || typeof input.trim !== 'object' || Array.isArray(input.trim)) {
      throw new Error('Trim must be an object with start and end numbers.');
    }
    const allowedTrimKeys = new Set(['start', 'end']);
    for (const key of Object.keys(input.trim)) {
      if (!allowedTrimKeys.has(key)) {
        throw new Error(`Unexpected trim property: "${key}".`);
      }
    }
    const start = Math.max(0, typeof input.trim.start === 'number' && !isNaN(input.trim.start) ? input.trim.start : 0);
    const end = Math.max(0, typeof input.trim.end === 'number' && !isNaN(input.trim.end) ? input.trim.end : 0);
    if (end > 0 && start >= end) {
      throw new Error('Trim start time must be less than end time.');
    }
    trim = {
      start: Number(start.toFixed(1)),
      end: Number(end.toFixed(1)),
    };
  }

  // Validate brand (optional)
  let brandConfig: BrandTagConfig | undefined = undefined;
  if (input.brand !== undefined && input.brand !== null) {
    if (typeof input.brand !== 'object' || Array.isArray(input.brand)) {
      throw new Error('Brand must be an object with content and position.');
    }
    const allowedBrandKeys = new Set(['content', 'position']);
    for (const key of Object.keys(input.brand)) {
      if (!allowedBrandKeys.has(key)) {
        throw new Error(`Unexpected brand property: "${key}".`);
      }
    }

    const content = typeof input.brand.content === 'string' ? input.brand.content.trim() : '';
    if (content.length > 30) {
      throw new Error('Brand tag content cannot exceed 30 characters.');
    }

    const position = input.brand.position ?? 'bottom_center';
    if (!ALLOWED_BRAND_POSITIONS.includes(position)) {
      throw new Error(
        `Invalid brand position: "${position}". Must be one of: ${ALLOWED_BRAND_POSITIONS.join(', ')}.`
      );
    }

    if (content) {
      brandConfig = { content, position };
    }
  }

  // Validate texts list (max 6 items)
  const sanitizedTexts: PlanTextItem[] = [];
  if (Array.isArray(input.texts)) {
    if (input.texts.length > 6) {
      throw new Error('Maximum of 6 text overlays allowed per video.');
    }

    const allowedItemKeys = new Set([
      'id',
      'content',
      'x',
      'y',
      'size',
      'color',
      'style',
      'start',
      'end',
      'fade_in',
    ]);

    for (let i = 0; i < input.texts.length; i++) {
      const item = input.texts[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`Text item at index ${i} must be a valid object.`);
      }

      for (const k of Object.keys(item)) {
        if (!allowedItemKeys.has(k)) {
          throw new Error(`Unexpected property "${k}" in text item at index ${i}.`);
        }
      }

      const content = typeof item.content === 'string' ? item.content.trim() : '';
      if (!content) {
        continue; // skip empty text items
      }
      if (content.length > 200) {
        throw new Error(`Text item at index ${i} content exceeds 200 characters.`);
      }

      // x, y: fractions clamped between 0.05 and 0.95
      let x = typeof item.x === 'number' && !isNaN(item.x) ? item.x : 0.5;
      x = Math.min(Math.max(Number(x.toFixed(3)), 0.05), 0.95);

      let y = typeof item.y === 'number' && !isNaN(item.y) ? item.y : 0.88;
      y = Math.min(Math.max(Number(y.toFixed(3)), 0.05), 0.95);

      const size = item.size ?? 'medium';
      if (!ALLOWED_SIZES.includes(size)) {
        throw new Error(
          `Invalid text size "${size}" at index ${i}. Must be one of: ${ALLOWED_SIZES.join(', ')}.`
        );
      }

      const color = item.color ?? 'white';
      if (!ALLOWED_COLORS.includes(color)) {
        throw new Error(
          `Invalid text color "${color}" at index ${i}. Must be one of: ${ALLOWED_COLORS.join(', ')}.`
        );
      }

      const style = item.style ?? 'clean';
      if (!ALLOWED_STYLES.includes(style)) {
        throw new Error(
          `Invalid text style "${style}" at index ${i}. Must be one of: ${ALLOWED_STYLES.join(', ')}.`
        );
      }

      const start = Math.max(0, typeof item.start === 'number' && !isNaN(item.start) ? Number(item.start.toFixed(1)) : 0);
      let end: number | null = null;
      if (typeof item.end === 'number' && !isNaN(item.end) && item.end > 0) {
        end = Number(item.end.toFixed(1));
        if (end <= start) {
          throw new Error(`Text item at index ${i} end time (${end}s) must be greater than start time (${start}s).`);
        }
      }

      let textFadeIn = typeof item.fade_in === 'number' && !isNaN(item.fade_in) ? item.fade_in : 0;
      textFadeIn = Math.min(Math.max(Math.round(textFadeIn), 0), 3);

      sanitizedTexts.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        content,
        x,
        y,
        size,
        color,
        style,
        start,
        end,
        fade_in: textFadeIn,
      });
    }
  } else if (input.text && typeof input.text === 'object') {
    // Backwards compatibility for single text
    const content = typeof input.text.content === 'string' ? input.text.content.trim() : '';
    if (content) {
      const pos = input.text.position ?? 'bottom';
      const y = pos === 'top' ? 0.12 : pos === 'center' ? 0.5 : 0.88;
      sanitizedTexts.push({
        content: content.slice(0, 200),
        x: 0.5,
        y,
        size: input.text.size ?? 'medium',
        color: input.text.color ?? 'white',
        style: 'box',
        start: 0,
        end: null,
        fade_in: Math.min(Math.max(Number(input.text.fade_in || 0), 0), 3),
      });
    }
  }

  return {
    texts: sanitizedTexts,
    brand: brandConfig,
    look,
    zoom,
    speed,
    trim,
    fade_in: fadeIn,
    fade_out: fadeOut,
  };
}
