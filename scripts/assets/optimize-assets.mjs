import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPublicFiles as listPublicFilesShared, slash } from '../../src/shared/shared-utils.mjs';
import { iconOutputs } from './generated-outputs.mjs';

// sharp ships prebuilt native binaries via optionalDependencies. On Windows a
// corrupted binary (interrupted npm install, antivirus quarantine, stale
// npm cache) throws deep inside the build with an intimidating stack trace.
// Load and smoke-test it explicitly so the failure is reported with an
// actionable repair recipe instead.
const loadSharp = async () => {
  try {
    const sharpModule = (await import('sharp')).default;

    await sharpModule({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    return sharpModule;
  } catch (error) {
    const reason = (error?.message || String(error)).split('\n')[0];
    console.error(
      [
        '',
        `ERROR: the native "sharp" module failed to load (${reason}).`,
        '',
        'This is a local environment issue - the project files are fine. The prebuilt',
        'sharp binary is usually corrupted by an interrupted "npm install" or by',
        'antivirus software scanning node_modules.',
        '',
        'Repair (run in the project root), then re-run the build:',
        '',
        '  PowerShell:',
        '    Remove-Item -Recurse -Force node_modules\\sharp, node_modules\\@img',
        '    npm cache clean --force',
        '    npm install --include=optional',
        '',
        '  bash:',
        '    rm -rf node_modules/sharp node_modules/@img',
        '    npm cache clean --force',
        '    npm install --include=optional',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
};

const sharp = await loadSharp();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = path.join(rootDir, 'public');
const docsDir = path.join(rootDir, 'docs');
const generatedDir = path.join(rootDir, 'src', 'generated');
const sourceIcon = path.join(rootDir, 'branding', 'xrdocs-icon.png');
const cacheFile = path.join(publicDir, '.asset-cache.json');
const assetMetadataFile = path.join(generatedDir, 'asset-metadata.json');
const cacheSchemaVersion = 3;
// Lossy AVIF (q62/e5) encodes orders of magnitude faster than lossless e9
// (~5x on real screenshots) and produces 5-6x smaller files. Lossless AVIF
// regularly LOSES to the source PNG on UI screenshots and was discarded as
// "skipped-larger" in 9 of 14 cases, wasting up to a minute of cold-build time.
const avifOptions = { quality: 62, effort: 5 };
const avifSourceExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const rasterAssetExtensions = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp']);
const avifSourcePriority = new Map([
  ['.png', 0],
  ['.jpg', 1],
  ['.jpeg', 1],
  ['.webp', 2],
]);

// Icon thumbnails generated from branding/xrdocs-icon.png (favicon,
// brand marks, OG image). They are tiny UI chrome — AVIF twins of them were
// either discarded as skipped-larger or shipped into dist unreferenced.
const iconOutputRelativePaths = new Set(
  iconOutputs.map((output) => slash(path.relative(publicDir, output.path))),
);

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const hashValue = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

const readCache = async () => {
  try {
    const cache = JSON.parse(await fs.readFile(cacheFile, 'utf8'));

    if (cache.version === cacheSchemaVersion && cache.assets) {
      return cache;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Ignoring unreadable asset cache: ${error.message}`);
    }
  }

  return { version: cacheSchemaVersion, assets: {} };
};

const outputExists = async (outputPath) => {
  try {
    await fs.access(outputPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const removeFileIfExists = async (filePath) => {
  try {
    await fs.rm(filePath, { force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const getPublicRelativePath = (filePath) => slash(path.relative(publicDir, filePath));

const shouldSkipPublicDir = (dirPath) => {
  const relativePath = getPublicRelativePath(dirPath);
  return relativePath === 'doc-content' || relativePath.startsWith('doc-content/');
};

const listOptimizablePublicFiles = () =>
  listPublicFilesShared(fs, publicDir, {
    joinPath: path.join,
    shouldSkipDir: shouldSkipPublicDir,
  });

// Article assets live colocated with the Markdown sources, under any
// `assets/` folder of docs/<lang>/… — e.g. docs/ru/texturing/assets/…
const listDocsAssetFiles = async () =>
  (await listPublicFilesShared(fs, docsDir, { joinPath: path.join }))
    .filter((filePath) => /(?:^|[/\\])assets[/\\]/.test(path.relative(docsDir, filePath)))
    .filter((filePath) => !path.basename(filePath).startsWith('.'));

const getDocsAssetKey = (filePath) => `docs/${slash(path.relative(docsDir, filePath))}`;

const getAssetPathFromKey = (key) =>
  key.startsWith('docs/')
    ? path.join(docsDir, ...key.slice('docs/'.length).split('/'))
    : path.join(publicDir, ...key.split('/'));

const isConvertibleRasterSource = (filePath) =>
  avifSourceExtensions.has(path.extname(filePath).toLowerCase());

const isRasterAsset = (filePath) =>
  rasterAssetExtensions.has(path.extname(filePath).toLowerCase());

const getAvifOutputPath = (sourcePath) =>
  path.join(path.dirname(sourcePath), `${path.basename(sourcePath, path.extname(sourcePath))}.avif`);

const iconOutputAvifRelativePaths = new Set(
  iconOutputs
    .filter((output) => avifSourceExtensions.has(path.extname(output.path).toLowerCase()))
    .map((output) => slash(path.relative(publicDir, getAvifOutputPath(output.path)))),
);

const getSourcePriority = (sourcePath) =>
  avifSourcePriority.get(path.extname(sourcePath).toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

const getTempOutputPath = (outputPath) =>
  path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.tmp`,
  );

const collectAvifOutputs = async () => {
  const outputMap = new Map();
  const addCandidate = (sourcePath, sourceKey) => {
    if (!isConvertibleRasterSource(sourcePath)) {
      return;
    }

    const outputPath = getAvifOutputPath(sourcePath);
    const outputKey = sourceKey.replace(/\.[^.]+$/, '.avif');
    const existing = outputMap.get(outputKey);

    if (!existing || getSourcePriority(sourcePath) < getSourcePriority(existing.sourcePath)) {
      outputMap.set(outputKey, { sourcePath, outputPath, key: outputKey, sourceKey });
    }
  };

  (await listOptimizablePublicFiles())
    .filter((filePath) => !iconOutputRelativePaths.has(getPublicRelativePath(filePath)))
    .forEach((filePath) => addCandidate(filePath, getPublicRelativePath(filePath)));
  (await listDocsAssetFiles())
    .forEach((filePath) => addCandidate(filePath, getDocsAssetKey(filePath)));

  const outputs = Array.from(outputMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  // Content-hash dedup: language copies of the same screenshot (docs/ru vs
  // docs/en) encode once — the twin copies the encoded AVIF afterwards.
  // Git already dedupes identical blobs, this removes the build-time cost.
  const leaderByContentHash = new Map();
  for (const output of outputs) {
    const contentHash = hashValue(await fs.readFile(output.sourcePath));
    const leader = leaderByContentHash.get(contentHash);

    if (leader) {
      output.copyFromKey = leader.key;
    } else {
      leaderByContentHash.set(contentHash, output);
    }
  }

  return outputs;
};

const removeStaleAvifOutputs = async (cache, avifOutputs) => {
  const expectedOutputs = new Set(avifOutputs.map((output) => output.key));
  const removals = [];

  for (const [key, cachedAsset] of Object.entries(cache.assets)) {
    if (cachedAsset?.type !== 'avif' || expectedOutputs.has(key)) {
      continue;
    }

    removals.push(removeFileIfExists(getAssetPathFromKey(key)));
    delete cache.assets[key];
  }

  // Icon thumbnails never get AVIF twins — drop any leftovers from previous
  // pipeline versions even when the cache no longer mentions them.
  for (const relativeOutputPath of iconOutputAvifRelativePaths) {
    removals.push(removeFileIfExists(path.join(publicDir, relativeOutputPath)));
    delete cache.assets[relativeOutputPath];
  }

  await Promise.all(removals);
};

const optimizeIconOutput = async (output, sourceHash, cache) => {
  const relativeOutputPath = getPublicRelativePath(output.path);
  const cacheKey = hashValue(
    stableStringify({
      type: 'icon',
      version: cacheSchemaVersion,
      sourceHash,
      width: output.width,
      format: output.format,
      options: output.options || {},
    }),
  );

  await fs.mkdir(path.dirname(output.path), { recursive: true });

  if (
    cache.assets[relativeOutputPath]?.cacheKey === cacheKey &&
    (await outputExists(output.path))
  ) {
    return { status: 'cached', relativeOutputPath, type: 'icon' };
  }

  await sharp(sourceIcon)
    .resize(output.width, output.width, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .toFormat(output.format, output.options || {})
    .toFile(output.path);

  cache.assets[relativeOutputPath] = {
    cacheKey,
    type: 'icon',
    width: output.width,
    format: output.format,
    options: output.options || {},
  };

  return { status: 'generated', relativeOutputPath, type: 'icon' };
};

const optimizeAvifOutput = async (output, cache) => {
  const sourceBuffer = await fs.readFile(output.sourcePath);
  const sourceSize = sourceBuffer.byteLength;
  const sourceHash = hashValue(sourceBuffer);
  const cacheKey = hashValue(
    stableStringify({
      type: 'avif',
      version: cacheSchemaVersion,
      sourceHash,
      source: output.sourceKey,
      format: 'avif',
      options: avifOptions,
    }),
  );
  const cachedAsset = cache.assets[output.key];

  if (
    cachedAsset?.cacheKey === cacheKey &&
    cachedAsset?.status === 'generated' &&
    (await outputExists(output.outputPath))
  ) {
    const avifSize = (await fs.stat(output.outputPath)).size;

    if (avifSize < sourceSize) {
      return {
        status: 'cached',
        key: output.key,
        source: output.sourceKey,
        type: 'avif',
      };
    }
  }

  if (cachedAsset?.cacheKey === cacheKey && cachedAsset?.status === 'skipped-larger') {
    await removeFileIfExists(output.outputPath);
    return {
      status: 'skipped-larger',
      key: output.key,
      source: output.sourceKey,
      type: 'avif',
    };
  }

  const metadata = await sharp(sourceBuffer).metadata();

  if (metadata.pages && metadata.pages > 1) {
    await removeFileIfExists(output.outputPath);
    cache.assets[output.key] = {
      cacheKey,
      type: 'avif',
      status: 'skipped',
      reason: 'multi-page',
      source: output.sourceKey,
      sourceSize,
      format: 'avif',
      options: avifOptions,
    };

    return {
      status: 'skipped',
      key: output.key,
      source: output.sourceKey,
      type: 'avif',
    };
  }

  const tempOutputPath = getTempOutputPath(output.outputPath);

  await sharp(sourceBuffer)
    .avif(avifOptions)
    .toFile(tempOutputPath);

  const avifSize = (await fs.stat(tempOutputPath)).size;

  if (avifSize >= sourceSize) {
    await Promise.all([
      removeFileIfExists(tempOutputPath),
      removeFileIfExists(output.outputPath),
    ]);

    cache.assets[output.key] = {
      cacheKey,
      type: 'avif',
      status: 'skipped-larger',
      source: output.sourceKey,
      sourceSize,
      avifSize,
      format: 'avif',
      options: avifOptions,
    };

    return {
      status: 'skipped-larger',
      key: output.key,
      source: output.sourceKey,
      type: 'avif',
    };
  }

  await fs.rename(tempOutputPath, output.outputPath);

  cache.assets[output.key] = {
    cacheKey,
    type: 'avif',
    status: 'generated',
    source: output.sourceKey,
    sourceSize,
    avifSize,
    format: 'avif',
    options: avifOptions,
  };

  return {
    status: 'generated',
    key: output.key,
    source: output.sourceKey,
    type: 'avif',
  };
};

/**
 * Materializes a language-twin AVIF from its already-processed leader
 * (identical source content). Mirrors the leader's decision: if the leader
 * was skipped/skipped-larger the twin gets the same verdict instead of a copy.
 */
const copyAvifOutput = async (output, cache) => {
  const sourceBuffer = await fs.readFile(output.sourcePath);
  const sourceSize = sourceBuffer.byteLength;
  const cacheKey = hashValue(
    stableStringify({
      type: 'avif',
      version: cacheSchemaVersion,
      sourceHash: hashValue(sourceBuffer),
      source: output.sourceKey,
      format: 'avif',
      options: avifOptions,
    }),
  );
  const cachedAsset = cache.assets[output.key];

  if (
    cachedAsset?.cacheKey === cacheKey &&
    cachedAsset?.status === 'generated' &&
    (await outputExists(output.outputPath))
  ) {
    return {
      status: 'cached',
      key: output.key,
      source: output.sourceKey,
      type: 'avif',
    };
  }

  const leaderRecord = cache.assets[output.copyFromKey];

  if (!leaderRecord) {
    // Leader has no cache record (unexpected state) — fall back to encoding.
    return optimizeAvifOutput(output, cache);
  }

  if (leaderRecord.status === 'skipped' || leaderRecord.status === 'skipped-larger') {
    if (leaderRecord.status === 'skipped-larger') {
      await removeFileIfExists(output.outputPath);
    }

    cache.assets[output.key] = {
      ...leaderRecord,
      cacheKey,
      source: output.sourceKey,
      sourceSize,
    };

    return {
      status: leaderRecord.status,
      key: output.key,
      source: output.sourceKey,
      type: 'avif',
    };
  }

  await fs.mkdir(path.dirname(output.outputPath), { recursive: true });
  await fs.copyFile(getAssetPathFromKey(output.copyFromKey), output.outputPath);
  const avifSize = (await fs.stat(output.outputPath)).size;

  cache.assets[output.key] = {
    cacheKey,
    type: 'avif',
    status: 'generated',
    source: output.sourceKey,
    sourceSize,
    avifSize,
    format: 'avif',
    options: avifOptions,
  };

  return {
    status: 'generated',
    key: output.key,
    source: output.sourceKey,
    type: 'avif',
    copied: true,
  };
};

const readRasterAssetInfo = async (filePath, key) => {
  const [stats, metadata] = await Promise.all([
    fs.stat(filePath),
    sharp(filePath).metadata(),
  ]);

  if (!metadata.width || !metadata.height) {
    return undefined;
  }

  return {
    path: key,
    byteSize: stats.size,
    width: metadata.width,
    height: metadata.height,
  };
};

const readRasterAssetInfos = async () => {
  const publicFiles = (await listOptimizablePublicFiles()).filter(isRasterAsset);
  const docsFiles = (await listDocsAssetFiles()).filter(isRasterAsset);
  const infos = await Promise.all([
    ...publicFiles.map((filePath) => readRasterAssetInfo(filePath, getPublicRelativePath(filePath))),
    ...docsFiles.map((filePath) => readRasterAssetInfo(filePath, getDocsAssetKey(filePath))),
  ]);
  return infos
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));
};

const buildPreferredPathMap = (infosByPath, cache) => {
  const preferredPathBySource = new Map();

  for (const [key, cachedAsset] of Object.entries(cache.assets)) {
    if (cachedAsset?.type !== 'avif' || cachedAsset.status !== 'generated' || !cachedAsset.source) {
      continue;
    }

    const sourceInfo = infosByPath.get(cachedAsset.source);
    const avifInfo = infosByPath.get(key);

    if (sourceInfo && avifInfo && avifInfo.byteSize < sourceInfo.byteSize) {
      preferredPathBySource.set(cachedAsset.source, key);
    }
  }

  return preferredPathBySource;
};

const writeAssetMetadata = async () => {
  const infos = await readRasterAssetInfos();
  const infosByPath = new Map(infos.map((info) => [info.path, info]));
  const preferredPathBySource = buildPreferredPathMap(infosByPath, cache);
  const avifOriginalPath = new Map(
    Object.entries(cache.assets)
      .filter(([, cachedAsset]) =>
        cachedAsset?.type === 'avif' &&
        cachedAsset.status === 'generated' &&
        cachedAsset.source
      )
      .map(([key, cachedAsset]) => [key, cachedAsset.source]),
  );
  const assets = Object.fromEntries(
    infos.map((info) => [
      info.path,
      {
        path: info.path,
        originalPath: avifOriginalPath.get(info.path) || info.path,
        preferredPath: preferredPathBySource.get(info.path) || info.path,
        byteSize: info.byteSize,
        width: info.width,
        height: info.height,
      },
    ]),
  );

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(
    `${assetMetadataFile}.tmp`,
    `${JSON.stringify({ version: 2, assets }, null, 2)}\n`,
  );
  await fs.rename(`${assetMetadataFile}.tmp`, assetMetadataFile);
};

const sourceBuffer = await fs.readFile(sourceIcon);
const iconSourceHash = hashValue(sourceBuffer);
const cache = await readCache();

const iconResults = await Promise.all(
  iconOutputs.map((output) => optimizeIconOutput(output, iconSourceHash, cache)),
);
const avifOutputs = await collectAvifOutputs();
await removeStaleAvifOutputs(cache, avifOutputs);
const avifLeaders = avifOutputs.filter((output) => !output.copyFromKey);
const avifFollowers = avifOutputs.filter((output) => output.copyFromKey);
const avifLeaderResults = await Promise.all(
  avifLeaders.map((output) => optimizeAvifOutput(output, cache)),
);
// Followers run strictly after leaders: twins copy the leader's AVIF result.
const avifFollowerResults = await Promise.all(
  avifFollowers.map((output) => copyAvifOutput(output, cache)),
);
const avifResults = [...avifLeaderResults, ...avifFollowerResults];
const copiedCount = avifFollowerResults.filter((result) => result.copied).length;
const results = [...iconResults, ...avifResults];

await fs.writeFile(`${cacheFile}.tmp`, `${JSON.stringify(cache, null, 2)}\n`);
await fs.rename(`${cacheFile}.tmp`, cacheFile);
await writeAssetMetadata();

const generatedCount = results.filter((result) => result.status === 'generated').length;
const cachedCount = results.filter((result) => result.status === 'cached').length;
const skippedCount = results.filter((result) => result.status === 'skipped').length;
const skippedLargerCount = results.filter((result) => result.status === 'skipped-larger').length;
const iconCount = results.filter((result) => result.type === 'icon').length;
const avifCount = results.filter((result) => result.type === 'avif').length;

console.log(
  `Optimized ${results.length} image assets (${iconCount} icons, ${avifCount} AVIF): ${generatedCount} generated, ${copiedCount} copied (content dedup), ${cachedCount} cached, ${skippedCount} skipped, ${skippedLargerCount} skipped larger.`,
);
