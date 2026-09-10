/**
 * Typed browser wrappers for shared Markdown heading utilities.
 */
import type { Lang } from '../../content/docs';
import {
  generateHeadingId as generateHeadingIdShared,
  slugifyHeading as slugifyHeadingShared,
} from '../string-utils.mjs';

export function slugifyHeading(value: string, lang: Lang): string {
  return slugifyHeadingShared(value, lang);
}

/**
 * Generates a deduplicated heading ID for a given title.
 * @param slugCounts - mutable counter Map shared across a single document render pass
 */
export function generateHeadingId(title: string, lang: Lang, slugCounts: Map<string, number>): string {
  return generateHeadingIdShared(title, lang, slugCounts);
}
