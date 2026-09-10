# Architecture

English | [Русский](meta-docs/ru/ARCHITECTURE.md)

xrDocs is a static documentation site: Markdown content in two languages is built by Vite into plain static files for GitHub Pages. There is no backend or server runtime.

## Project map

```text
branding/               master brand assets (source of truth)
  xrdocs-icon.png       single icon source; all site icons are generated from it
docs/                   site content — articles and their images live together
  ru/ · en/             one folder per language, mirrored structure
    init.md             menu order and sections (not rendered as a page)
    <section>/*.md      articles
    <section>/assets/   article screenshots, referenced as ./assets/…
meta-docs/ru/           Russian translations of the repo meta documents
public/                 files served verbatim (robots.txt, verification file)
  assets/               site-wide images (icons, theme assets), referenced as /assets/…
src/                    browser code
  app/                  entry point, shell, routing, state, theme, styles
  content/              docs model, article rendering, nav, toc, Markdown
  search/               client-side search
  statistics/           analytics integration
  shared/               browser-safe modules reused by build scripts
    markdown/           Markdown renderer core, highlighting, string utils
    render/             HTML shell and nav renderers (browser + prerender)
    utils/ · locales/   shared helpers and UI labels
  generated/            build output manifests (gitignored)
scripts/                build pipeline CLI steps
  content/              content model, Markdown rendering, manifests, search index
  assets/               image optimization (AVIF twins, icon set)
  prerender/            static HTML generation for GitHub Pages
  shared/               node-only helpers
.github/                workflows, issue/PR templates
```

## Dependency rule

`scripts/` may import from `src/shared/`. `src/` must never import from `scripts/`. Modules in `src/shared/` must stay browser-safe and dependency-light: they are bundled into the client chunk.

## Build pipeline

```text
npm run build
  ├─ optimize:assets   scripts/assets/optimize-assets.mjs
  │    generates site icons from branding/xrdocs-icon.png and AVIF twins for
  │    public/ and docs/ raster images (cached in public/.asset-cache.json,
  │    metadata written to src/generated/asset-metadata.json)
  ├─ prepare:content   scripts/content/generate-content-data.mjs
  │    parses docs/<lang>/init.md, renders Markdown to HTML (dist staging),
  │    writes docs-manifest / theme-assets / heading-aliases / search index
  ├─ tsc               TypeScript strict checks
  ├─ vite build        bundles the client app into dist/
  └─ prerender         scripts/prerender/prerender.mjs
       renders static HTML per page, copies docs/<lang>/…/assets/ into
       dist/docs/…, writes sitemap.xml and robots.txt
```

During `npm run dev` a Vite middleware serves `docs/<lang>/…/assets/` files, so relative image references behave exactly like in production. Markdown changes trigger content regeneration with full reload.

## Asset addressing rules

| Reference in Markdown | Resolves to | Example |
|---|---|---|
| `./assets/…`, `../assets/…` | article assets colocated under `docs/<lang>/<section>/assets/`, served from `docs/<lang>/…` | `![TGA settings](./assets/icon-atlases/tga-settings.png)` |
| `/assets/…` | site-wide theme assets from `public/assets/` | `/assets/examples/xrdocs-icon.png` |
| `https://…`, `data:` | untouched | — |

If a smaller AVIF twin was generated, the renderer swaps it in automatically and adds `width`/`height` from the asset manifest.

## Adding content

1. Create `docs/<lang>/<section>/<article>.md` (lowercase kebab-case file name).
2. Put screenshots into `docs/<lang>/<section>/assets/…` and reference them relatively.
3. Register the page in `docs/<lang>/init.md`; mirror the path in the other language.
4. Run `npm run check` to validate links and image paths.

Brand icons are never edited by hand in `public/` — change `branding/xrdocs-icon.png` and let `optimize:assets` regenerate all sizes.
