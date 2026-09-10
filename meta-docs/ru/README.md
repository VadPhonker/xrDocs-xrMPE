<div align="center">
  <h1>xrDocs</h1>

  <h4>Статический сайт документации по моддингу <i>S.T.A.L.K.E.R.</i></h4>

  <p>
    <a href="../../README.md">English</a>
    |
    Русский
  </p>

  <p>
    <img src="../../branding/xrdocs-icon.png" alt="xrDocs" width="128" />
  </p>

  <p>
    <a href="https://github.com/VadFonker-cyber/xrDocs-xrMPE/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="Лицензия" />
    </a>
    <a href="https://vite.dev/">
      <img src="https://img.shields.io/badge/Vite-8.0-646CFF.svg?logo=vite&logoColor=white" alt="Vite" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6.svg?logo=typescript&logoColor=white" alt="TypeScript" />
    </a>
    <a href="https://github.com/VadFonker-cyber/xrDocs-xrMPE/actions/workflows/pages.yml">
      <img src="https://github.com/VadFonker-cyber/xrDocs-xrMPE/actions/workflows/pages.yml/badge.svg" alt="Deploy Pages" />
    </a>
  </p>
</div>

## Обзор

xrDocs - статический сайт документации по моддингу S.T.A.L.K.E.R. Материалы пишутся в Markdown, разделяются по языкам и собираются Vite в обычные статические файлы для GitHub Pages.

## Возможности

- русская и английская версии документации
- навигация по `docs/ru/init.md` и `docs/en/init.md`
- hash-маршруты, удобные для GitHub Pages
- поиск по текущему языку
- подсветка кода через `highlight.js`
- сборка без backend и серверной части

## Быстрый старт

Требования:

- Node.js 24 или новее
- npm
- Windows PowerShell или другой терминал

На Windows PowerShell используйте `npm.cmd`, потому что `npm.ps1` может блокироваться политикой выполнения скриптов.

```powershell
npm.cmd install
npm.cmd run dev
```

Локальный сервер обычно открывается на `http://127.0.0.1:5173/`.

Можно также запустить:

```bat
dev.bat
```

Скрипт установит зависимости, если `node_modules` отсутствует, и запустит dev-сервер.

## Сборка

```powershell
npm.cmd run build
```

Команда запускает TypeScript-проверку и собирает production-версию в `dist/`.

Для локальной проверки production-сборки:

```powershell
npm.cmd run preview
```

## Структура проекта

```text
docs/ru/**/*.md             русская документация (картинки в <раздел>/assets/)
docs/en/**/*.md             английская документация (зеркальная структура)
docs/ru/init.md             порядок русского меню
docs/en/init.md             порядок английского меню
branding/                   мастер-ассеты бренда; из них генерируются иконки сайта
meta-docs/ru/               русские переводы мета-документации репозитория
src/                        код браузера: app, content, search, statistics, shared
scripts/                    пайплайн сборки: content, assets, prerender
public/                     общие статические ассеты сайта
ARCHITECTURE.md             карта проекта и пайплайн сборки
.github/workflows/pages.yml сборка и публикация на GitHub Pages
```

Файлы `init.md` задают порядок и группы меню. Они не рендерятся как статьи.

## Как добавить страницу

1. Создайте Markdown-файл в нужном языке, например `docs/ru/weapons/ballistics.md`.
2. Добавьте H1-заголовок. Он используется как название страницы.
3. Добавьте страницу в `docs/ru/init.md` и зеркальный файл в `docs/en/init.md`, если нужен перевод.

```md
# Баллистика оружия
```

Старайтесь держать переводы по одинаковым относительным путям:

```text
docs/ru/addon-structure.md
docs/en/addon-structure.md
```

Внутренние ссылки на `.md` автоматически превращаются в маршруты сайта.

## Публикация

Workflow `.github/workflows/pages.yml` собирает проект на push в `main` и публикует папку `dist/` через GitHub Pages. В настройках репозитория GitHub Pages должен быть выбран источник **GitHub Actions**.

## Список изменений

Значимые изменения документируются в [релизах GitHub](https://github.com/VadFonker-cyber/xrDocs-xrMPE/releases).

## Участие

Перед изменениями прочитайте [CONTRIBUTING.md](CONTRIBUTING.md). Для отчетов об ошибках и предложений используйте GitHub Issues.

## Лицензия

Код и документация распространяются по лицензии [MIT](/LICENSE). Неофициальный русский перевод находится в [LICENSE.md](LICENSE.md).
