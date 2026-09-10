import MarkdownIt from 'markdown-it';
import type { Lang } from './docs';
import { getLabel, type LabelKey } from '../shared/locales';
import { getAssetUrl, getDocUrl } from '../app/routing';
import type { RenderedDoc } from '../shared/types';
import assetMetadata from '../generated/asset-metadata.json';
import { createMarkdownRenderer } from '../shared/markdown/markdown-renderer-core.mjs';

type RenderOptions = {
  basePath: string;
  docId?: string;
};

type AssetInfo = {
  path: string;
  originalPath: string;
  preferredPath: string;
  byteSize: number;
  width: number;
  height: number;
};

type AssetMetadata = {
  assets?: Record<string, AssetInfo>;
};

const renderer = createMarkdownRenderer({
  MarkdownIt,
  assetMetadata: assetMetadata as AssetMetadata,
  getAssetUrl,
  getCalloutTitle: (kind, lang) => getLabel(lang as Lang, `callout.${kind}` as LabelKey),
  getDocUrl,
  getLabel: (lang, key) => getLabel(lang as Lang, key as LabelKey),
});

export function renderDocContent(content: string, lang: Lang, options: RenderOptions): RenderedDoc {
  return renderer.renderDocContent(content, lang, options) as RenderedDoc;
}
