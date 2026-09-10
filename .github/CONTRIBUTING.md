# Contributing Guide

English | [Русский](../meta-docs/ru/CONTRIBUTING.md)

Thank you for your interest in xrDocs. The project accepts documentation fixes, new articles, navigation improvements, search updates, styling changes, and infrastructure work.

## Before you start

- Check open Issues and Pull Requests to avoid duplicate work.
- For larger changes, open an Issue first with a short proposal.
- For small typo or link fixes, opening a Pull Request directly is fine.

## Local development

```powershell
npm.cmd install
npm.cmd run dev
```

Build before opening a Pull Request:

```powershell
npm.cmd run build
```

You can also validate article links and image paths without a full build:

```powershell
npm.cmd run check
```

On Windows PowerShell, use `npm.cmd` to avoid execution policy issues.

## Documentation

Every page should include frontmatter:

```md
---
section: Section
order: 10
summary: Short menu and search description.
---
```

Rules:

- The Markdown H1 is the page title.
- File names use lowercase kebab-case, for example `addon-structure.md`.
- Russian pages live in `docs/ru`; English pages live in `docs/en`.
- Keep translations at matching relative paths when possible.
- If a page needs a stable menu position, update the matching `init.md`.
- Write internal links to `.md` files, for example `[addon structure](addon-structure.md)`.

### Images

- Keep screenshots next to the article: store them under `docs/<lang>/<section>/assets/…` and reference them relatively, for example `![TGA settings](./assets/icon-atlases/tga-settings.png)`.
- Site-wide images (icons, theme assets) live in `public/assets/…` and are referenced with a root-absolute path, for example `/assets/examples/xrdocs-icon.png`.
- AVIF twins are generated automatically by `npm run optimize:assets` — commit only the source PNG/JPG/WebP files.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full project map and build pipeline.

## Code

- TypeScript uses strict mode.
- Source layout: `src/app` (shell, routing, state, theme), `src/content` (docs, article, nav, toc, Markdown), `src/search`, `src/statistics`, and `src/shared` (types, locales, utils, plus browser-safe modules reused by build scripts).
- Build pipeline lives in `scripts/` (`content/`, `assets/`, `prerender/`, `shared/`). Scripts may import from `src/shared/`, but `src/` must never import from `scripts/`.
- Do not add backend dependencies: the project should remain a static site.
- Prefer explicit types for shared structures.
- Do not commit `dist/`, `node_modules/`, or log files.

## Pull requests

Include:

- the user-visible change;
- affected documentation files or languages.

CI automatically runs the production build for Pull Requests.

Use short, clear commit messages such as `Add English addon guide` or `Fix search result labels`.

## Conduct

By participating, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
