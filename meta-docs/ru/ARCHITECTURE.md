# Архитектура

[English](../../ARCHITECTURE.md) | Русский

xrDocs - статический сайт документации: Markdown-контент на двух языках собирается Vite в обычные статические файлы для GitHub Pages. Без backend и серверной части.

## Карта проекта

```text
branding/               мастер-ассеты бренда (источник истины)
  xrdocs-icon.png       единственный исходник; все иконки сайта генерируются из него
docs/                   контент сайта - статьи и их картинки лежат вместе
  ru/ · en/             по папке на язык, зеркальная структура
    init.md             порядок и группы меню (не рендерится как страница)
    <раздел>/*.md       статьи
    <раздел>/assets/    скриншоты статьи, ссылки вида ./assets/…
meta-docs/ru/           русские переводы мета-документации репозитория
public/                 файлы, отдаваемые «как есть» (robots.txt, верификация)
  assets/               общие картинки сайта (иконки, ассеты темы), ссылки вида /assets/…
src/                    код браузера
  app/                  точка входа, оболочка, роутинг, состояние, тема, стили
  content/              модель документов, рендер статьи, навигация, оглавление, Markdown
  search/               клиентский поиск
  statistics/           интеграция аналитики
  shared/               browser-safe модули, используемые и скриптами сборки
    markdown/           ядро Markdown-рендера, подсветка, строковые утилиты
    render/             HTML-оболочка и рендер навигации (браузер + prerender)
    utils/ · locales/   общие хелперы и подписи интерфейса
  generated/            манифесты сборки (в git не хранятся)
scripts/                CLI-шаги пайплайна сборки
  content/              контент-модель, рендер Markdown, манифесты, поисковый индекс
  assets/               оптимизация картинок (AVIF-твины, набор иконок)
  prerender/            генерация статического HTML для GitHub Pages
  shared/               node-only хелперы
.github/                workflow, шаблоны Issue/PR
```

## Правило зависимостей

`scripts/` может импортировать из `src/shared/`. `src/` не должен импортировать из `scripts/`. Модули в `src/shared/` остаются browser-safe и без тяжёлых зависимостей: они попадают в клиентский бандл.

## Пайплайн сборки

```text
npm run build
  ├─ optimize:assets   scripts/assets/optimize-assets.mjs
  │    генерирует иконки сайта из branding/xrdocs-icon.png и AVIF-твины для
  │    картинок в public/ и docs/ (кэш - public/.asset-cache.json, метаданные -
  │    src/generated/asset-metadata.json)
  ├─ prepare:content   scripts/content/generate-content-data.mjs
  │    разбирает docs/<lang>/init.md, рендерит Markdown в HTML, пишет
  │    docs-manifest / theme-assets / heading-aliases / поисковый индекс
  ├─ tsc               строгая проверка типов
  ├─ vite build        собирает клиентское приложение в dist/
  └─ prerender         scripts/prerender/prerender.mjs
       рендерит статический HTML по страницам, копирует docs/<lang>/…/assets/
       в dist/docs/…, пишет sitemap.xml и robots.txt
```

Во время `npm run dev` Vite-middleware отдаёт файлы `docs/<lang>/…/assets/`, поэтому относительные ссылки на картинки работают так же, как в production. Изменение Markdown запускает регенерацию контента с полной перезагрузкой.

## Правила адресации ассетов

| Ссылка в Markdown | Указывает на | Пример |
|---|---|---|
| `./assets/…`, `../assets/…` | ассеты статьи в `docs/<язык>/<раздел>/assets/`, отдаются с `docs/<язык>/…` | `![Настройки TGA](./assets/icon-atlases/tga-settings.png)` |
| `/assets/…` | общие ассеты темы из `public/assets/` | `/assets/examples/xrdocs-icon.png` |
| `https://…`, `data:` | не обрабатываются | — |

Если сгенерирован меньший AVIF-твин, рендер автоматически подставит его и добавит `width`/`height` из манифеста ассетов.

## Как добавить материал

1. Создайте `docs/<язык>/<раздел>/<статья>.md` (имя файла - lowercase kebab-case).
2. Скриншоты положите в `docs/<язык>/<раздел>/assets/…` и ссылайтесь относительным путём.
3. Зарегистрируйте страницу в `docs/<язык>/init.md`; в другом языке сделайте зеркальный путь.
4. Запустите `npm run check` для проверки ссылок и путей к картинкам.

Иконки бренда не правятся руками в `public/` - измените `branding/xrdocs-icon.png` и позвольте `optimize:assets` регенерировать все размеры.
