export type CaptionPosition = 'top' | 'center' | 'bottom';
export type CaptionSize = 'small' | 'medium' | 'large';
export type CaptionColor = 'white' | 'yellow' | 'black';
export type VideoLook = 'none' | 'cinematic' | 'warm' | 'cool' | 'bw' | 'vivid';
export type VideoZoom = 'none' | 'slow_in' | 'slow_out';

export interface CaptionConfig {
  content: string;
  position: CaptionPosition;
  size: CaptionSize;
  color: CaptionColor;
  fade_in: number;
}

export interface TrimConfig {
  start: number;
  end: number;
}

export interface RenderPlan {
  text?: CaptionConfig;
  look: VideoLook;
  zoom: VideoZoom;
  speed: number;
  trim: TrimConfig;
  fade_in: number;
  fade_out: number;
}

export const ALLOWED_POSITIONS: CaptionPosition[] = ['top', 'center', 'bottom'];
export const ALLOWED_SIZES: CaptionSize[] = ['small', 'medium', 'large'];
export const ALLOWED_COLORS: CaptionColor[] = ['white', 'yellow', 'black'];
export const ALLOWED_LOOKS: VideoLook[] = ['none', 'cinematic', 'warm', 'cool', 'bw', 'vivid'];
export const ALLOWED_ZOOMS: VideoZoom[] = ['none', 'slow_in', 'slow_out'];

export const DEFAULT_PLAN: RenderPlan = {
  text: {
    content: '',
    position: 'bottom',
    size: 'medium',
    color: 'white',
    fade_in: 0,
  },
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
  const allowedTopKeys = new Set(['text', 'look', 'zoom', 'speed', 'trim', 'fade_in', 'fade_out']);
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

  // Validate text/caption
  let textConfig: CaptionConfig | undefined = undefined;
  if (input.text !== undefined && input.text !== null) {
    if (typeof input.text !== 'object' || Array.isArray(input.text)) {
      throw new Error('Text configuration must be an object.');
    }
    const allowedTextKeys = new Set(['content', 'position', 'size', 'color', 'fade_in']);
    for (const key of Object.keys(input.text)) {
      if (!allowedTextKeys.has(key)) {
        throw new Error(`Unexpected text property: "${key}".`);
      }
    }

    const content = typeof input.text.content === 'string' ? input.text.content : '';
    if (content.length > 200) {
      throw new Error('Caption content cannot exceed 200 characters.');
    }

    const position = input.text.position ?? 'bottom';
    if (!ALLOWED_POSITIONS.includes(position)) {
      throw new Error(`Invalid caption position: "${position}". Must be one of: ${ALLOWED_POSITIONS.join(', ')}.`);
    }

    const size = input.text.size ?? 'medium';
    if (!ALLOWED_SIZES.includes(size)) {
      throw new Error(`Invalid caption size: "${size}". Must be one of: ${ALLOWED_SIZES.join(', ')}.`);
    }

    const color = input.text.color ?? 'white';
    if (!ALLOWED_COLORS.includes(color)) {
      throw new Error(`Invalid caption color: "${color}". Must be one of: ${ALLOWED_COLORS.join(', ')}.`);
    }

    let textFadeIn = typeof input.text.fade_in === 'number' ? input.text.fade_in : 0;
    if (isNaN(textFadeIn)) throw new Error('Caption fade_in must be a number.');
    textFadeIn = Math.min(Math.max(Math.round(textFadeIn), 0), 3);

    textConfig = {
      content,
      position,
      size,
      color,
      fade_in: textFadeIn,
    };
  }

  return {
    text: textConfig,
    look,
    zoom,
    speed,
    trim,
    fade_in: fadeIn,
    fade_out: fadeOut,
  };
}
