import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const siteMetaData = require('../../src/shared/site-meta.json');

export const { siteName, githubUrl, siteMeta } = siteMetaData;
