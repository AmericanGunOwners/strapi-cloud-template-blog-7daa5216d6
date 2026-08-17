'use strict';

/**
 * One-off migration helper for AGODEV-1513 (article.category manyToOne -> categories manyToMany).
 *
 * Strapi's schema sync creates a new join table for the manyToMany relation but does not
 * copy data from the old manyToOne column, so existing article<->category links must be
 * captured before the schema change deploys and re-applied after, via the REST API.
 *
 * Usage:
 *   STRAPI_URL=https://<your-app>.strapiapp.com STRAPI_API_TOKEN=xxx node scripts/migrate-article-categories.js export
 *     -> run BEFORE deploying the schema change. Writes ./data/article-categories-backup.json
 *   STRAPI_URL=https://<your-app>.strapiapp.com STRAPI_API_TOKEN=xxx node scripts/migrate-article-categories.js import
 *     -> run AFTER deploying the schema change. Reads the backup file and re-links each article.
 */

const fs = require('fs-extra');
const path = require('path');

const BACKUP_PATH = path.join(__dirname, '..', 'data', 'article-categories-backup.json');
const PAGE_SIZE = 100;

function getEnv() {
  const baseUrl = process.env.STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error('Set STRAPI_URL and STRAPI_API_TOKEN environment variables before running this script.');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

async function strapiFetch(baseUrl, token, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request to ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function exportExistingLinks() {
  const { baseUrl, token } = getEnv();
  const links = [];
  let page = 1;

  while (true) {
    const query =
      `/api/articles?populate=category&pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}` +
      `&publicationState=preview`;
    const { data, meta } = await strapiFetch(baseUrl, token, query);

    for (const article of data) {
      const categoryId = article.category?.id ?? article.attributes?.category?.data?.id ?? null;
      if (categoryId) {
        links.push({ articleId: article.id, categoryId });
      }
    }

    console.log(`Fetched page ${page}/${meta.pagination.pageCount} (${data.length} articles)`);
    if (page >= meta.pagination.pageCount) break;
    page += 1;
  }

  await fs.ensureDir(path.dirname(BACKUP_PATH));
  await fs.writeJson(BACKUP_PATH, links, { spaces: 2 });
  console.log(`Saved ${links.length} article-category links to ${BACKUP_PATH}`);
}

async function importSavedLinks() {
  const { baseUrl, token } = getEnv();

  if (!(await fs.pathExists(BACKUP_PATH))) {
    throw new Error(`No backup file found at ${BACKUP_PATH}. Run the "export" step before deploying the schema change.`);
  }

  const links = await fs.readJson(BACKUP_PATH);
  console.log(`Re-linking ${links.length} articles to their category...`);

  for (const { articleId, categoryId } of links) {
    await strapiFetch(baseUrl, token, `/api/articles/${articleId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: { categories: { connect: [categoryId] } } }),
    });
    console.log(`Article ${articleId} -> category ${categoryId} OK`);
  }

  console.log('Done. Spot-check a few articles in the admin UI to confirm the categories field is populated.');
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'export') {
    await exportExistingLinks();
  } else if (mode === 'import') {
    await importSavedLinks();
  } else {
    console.error('Usage: node scripts/migrate-article-categories.js <export|import>');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
