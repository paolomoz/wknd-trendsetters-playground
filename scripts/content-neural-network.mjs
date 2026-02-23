#!/usr/bin/env node

/**
 * Content Neural Network — semantic content graph builder for WKND Trendsetters.
 * Zero dependencies — uses Node 18+ built-in fetch() and crypto.
 *
 * Usage:
 *   node scripts/content-neural-network.mjs                # full pipeline
 *   node scripts/content-neural-network.mjs --force         # re-extract + re-embed all
 *   node scripts/content-neural-network.mjs --report        # regenerate HTML from cached data
 *   node scripts/content-neural-network.mjs --extract-only  # extract nodes only (no embeddings)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'content-graph');
const REPORT_PATH = join(ROOT, 'reports', 'content-neural-network.html');
const SRC_DIR = join(ROOT, 'src');

// Load .env manually
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();
const VOYAGE_KEY = process.env.VOYAGE_API_KEY || '';

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const REPORT_ONLY = ARGS.includes('--report');
const EXTRACT_ONLY = ARGS.includes('--extract-only');

const SIMILARITY_THRESHOLD = 0.45;
const DISPLAY_THRESHOLD = 0.55; // Default slider position in the report

/* ─── Page Registry (matches pagespeed-collect.mjs) ─── */

const PAGES = {
  static: [
    { slug: 'home', path: '/', file: 'index.astro' },
    { slug: 'fashion-trends-young-adults', path: '/fashion-trends-young-adults', file: 'fashion-trends-young-adults.astro' },
    { slug: 'fashion-trends-young-adults-casual-sport', path: '/fashion-trends-young-adults-casual-sport', file: 'fashion-trends-young-adults-casual-sport.astro' },
    { slug: 'fashion-insights', path: '/fashion-insights', file: 'fashion-insights.astro' },
    { slug: 'fashion-trends-of-the-season', path: '/fashion-trends-of-the-season', file: 'fashion-trends-of-the-season.astro' },
    { slug: 'latest-trends-young-fashion', path: '/latest-trends-young-fashion', file: 'latest-trends-young-fashion.astro' },
    { slug: 'faq', path: '/faq', file: 'faq.astro' },
    { slug: 'testimonial', path: '/testimonial', file: 'testimonial.astro' },
    { slug: 'products', path: '/products', file: 'products.astro' },
    { slug: 'case-studies', path: '/case-studies', file: 'case-studies.astro' },
  ],
  blog: [
    { slug: 'blog-fashion-blog-post', path: '/blog/fashion-blog-post', file: 'fashion-blog-post.md' },
    { slug: 'blog-fashion-trends-young-culture', path: '/blog/fashion-trends-young-culture', file: 'fashion-trends-young-culture.md' },
    { slug: 'blog-fashion-trends-young-style', path: '/blog/fashion-trends-young-style', file: 'fashion-trends-young-style.md' },
    { slug: 'blog-latest-trends-young-casual-fashion', path: '/blog/latest-trends-young-casual-fashion', file: 'latest-trends-young-casual-fashion.md' },
    { slug: 'blog-street-style-trends', path: '/blog/street-style-trends', file: 'street-style-trends.md' },
    { slug: 'blog-flip-flop-summer-style', path: '/blog/flip-flop-summer-style', file: 'flip-flop-summer-style.md' },
  ],
};

const LIVE_BASE = 'https://wknd-trendsetters.pages.dev';

/* ─── Helpers ─── */

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function nodeId(pageSlug, type, title) {
  return `${pageSlug}__${type}__${slugify(title)}`;
}

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

function truncate(str, max = 2000) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function stripMarkdown(md) {
  return md
    .replace(/^#{1,6}\s+/gm, '')        // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')       // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^>\s*/gm, '')              // blockquotes
    .replace(/^[-*]\s+/gm, '')           // list items
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── Content Extraction ─── */

function readAstroFile(filename) {
  const path = join(SRC_DIR, 'pages', filename);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

function readBlogFile(filename) {
  const path = join(SRC_DIR, 'content', 'blog', filename);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

function splitAstroFrontmatter(content) {
  const parts = content.split('---');
  if (parts.length < 3) return { frontmatter: '', template: content };
  return { frontmatter: parts[1], template: parts.slice(2).join('---') };
}

/** Extract JS array from frontmatter using regex */
function extractArray(frontmatter, varName) {
  // Match: const varName = [ ... ];
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm');
  const m = frontmatter.match(re);
  if (!m) return [];

  const arrayBody = m[1];
  const items = [];

  // Match each object literal { ... }
  const objRe = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let om;
  while ((om = objRe.exec(arrayBody)) !== null) {
    const obj = {};
    const body = om[1];

    // Extract key: 'value' or key: "value" pairs
    const kvRe = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)")/g;
    let kv;
    while ((kv = kvRe.exec(body)) !== null) {
      obj[kv[1]] = kv[2] ?? kv[3];
    }

    if (Object.keys(obj).length > 0) items.push(obj);
  }

  return items;
}

/** Extract Hero component props from template */
function extractHero(template) {
  const heroMatch = template.match(/<Hero\s([^>]*(?:\{[\s\S]*?\}[^>]*)*)\/?\s*>/);
  if (!heroMatch) return null;

  const propsStr = heroMatch[1];
  const titleM = propsStr.match(/title="([^"]*)"/);
  const subtitleM = propsStr.match(/subtitle="([^"]*)"/);

  if (!titleM) return null;

  // Extract first image src from images prop (inline or variable reference)
  let imageSrc = null;
  const inlineImgM = propsStr.match(/src:\s*'([^']+)'/);
  if (inlineImgM) imageSrc = inlineImgM[1];

  return {
    title: titleM[1],
    subtitle: subtitleM ? subtitleM[1] : '',
    imageSrc,
  };
}

/** Resolve Hero image from a variable name defined in frontmatter */
function resolveHeroImage(frontmatter, template) {
  // Match images={varName}
  const heroTag = template.match(/<Hero\s([^>]*(?:\{[\s\S]*?\}[^>]*)*)\/?\s*>/);
  if (!heroTag) return null;
  const varRefM = heroTag[1].match(/images=\{(\w+)\}/);
  if (!varRefM) return null;
  const varName = varRefM[1];
  // Find the variable definition and extract first src
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm');
  const m = frontmatter.match(re);
  if (!m) return null;
  const srcM = m[1].match(/src:\s*'([^']+)'/);
  return srcM ? srcM[1] : null;
}

/** Extract CTASection component props from template */
function extractCTA(template) {
  const ctaMatch = template.match(/<CTASection\s([^>]*(?:\{[\s\S]*?\}[^>]*)*)\/?\s*>/);
  if (!ctaMatch) return null;

  const propsStr = ctaMatch[1];
  const titleM = propsStr.match(/title="([^"]*)"/);
  const subtitleM = propsStr.match(/subtitle="([^"]*)"/);
  const imageM = propsStr.match(/image="([^"]*)"/);

  if (!titleM) return null;
  return {
    title: titleM[1],
    subtitle: subtitleM ? subtitleM[1] : '',
    image: imageM ? imageM[1] : null,
  };
}

/** Extract inline HTML sections (h2/h3/h4 + adjacent paragraphs) from template */
function extractInlineSections(template, pageSlug) {
  const nodes = [];
  // Match h2/h3/h4 headings (both class-based and plain)
  const headingRe = /<h([234])[^>]*>([^<]+)<\/h\1>/g;
  let hm;
  while ((hm = headingRe.exec(template)) !== null) {
    const title = hm[2].trim();
    // Look for paragraph text after this heading
    const afterHeading = template.slice(hm.index + hm[0].length, hm.index + hm[0].length + 500);
    const pMatch = afterHeading.match(/<p[^>]*>([^<]+)<\/p>/);
    const text = pMatch ? pMatch[1].trim() : '';

    if (title && title.length > 5) {
      nodes.push({
        id: nodeId(pageSlug, 'feature', title),
        type: 'feature',
        title,
        text,
        page: pageSlug,
      });
    }
  }
  return nodes;
}

function extractFromAstroPage(page) {
  const content = readAstroFile(page.file);
  if (!content) return [];

  const { frontmatter, template } = splitAstroFrontmatter(content);
  const nodes = [];
  const pageUrl = `${LIVE_BASE}${page.path}`;

  // Hero
  const hero = extractHero(template);
  if (hero) {
    // Resolve hero image: try inline first, then variable reference
    let heroImage = hero.imageSrc || resolveHeroImage(frontmatter, template);
    nodes.push({
      id: nodeId(page.slug, 'hero', hero.title),
      type: 'hero',
      title: hero.title,
      text: hero.subtitle,
      page: page.slug,
      pageUrl,
      image: heroImage,
    });
  }

  // CTA
  const cta = extractCTA(template);
  if (cta) {
    nodes.push({
      id: nodeId(page.slug, 'cta', cta.title),
      type: 'cta',
      title: cta.title,
      text: cta.subtitle,
      page: page.slug,
      pageUrl,
      image: cta.image,
    });
  }

  // Articles / ArticleCards
  const articles = extractArray(frontmatter, 'articles');
  for (const a of articles) {
    if (a.title) {
      nodes.push({
        id: nodeId(page.slug, 'article', a.title),
        type: 'article',
        title: a.title,
        text: a.category ? `${a.category}. ${a.title}` : a.title,
        page: page.slug,
        pageUrl,
        category: a.category || null,
        href: a.href || null,
        image: a.image || null,
      });
    }
  }

  // Trend articles (fashion-trends-young-adults uses trendArticles)
  const trendArticles = extractArray(frontmatter, 'trendArticles');
  for (const a of trendArticles) {
    if (a.title) {
      nodes.push({
        id: nodeId(page.slug, 'article', a.title),
        type: 'article',
        title: a.title,
        text: a.category ? `${a.category}. ${a.title}` : a.title,
        page: page.slug,
        pageUrl,
        category: a.category || null,
        href: a.href || null,
        image: a.image || null,
      });
    }
  }

  // Categories / TrendCards
  const categories = extractArray(frontmatter, 'categories');
  for (const c of categories) {
    if (c.title) {
      nodes.push({
        id: nodeId(page.slug, 'trend', c.title),
        type: 'trend',
        title: c.title,
        text: c.description || '',
        page: page.slug,
        pageUrl,
        category: c.category || null,
        image: c.image || null,
      });
    }
  }

  // Tabs / Testimonial personas
  const tabs = extractArray(frontmatter, 'tabs');
  for (const t of tabs) {
    if (t.name) {
      nodes.push({
        id: nodeId(page.slug, 'persona', t.name),
        type: 'persona',
        title: t.name,
        text: `${t.role || ''}. ${t.quote || ''}`,
        page: page.slug,
        pageUrl,
        persona: t.name,
        image: t.image || null,
        avatar: t.avatarImage || null,
      });
    }
  }

  // Testimonials
  const testimonials = extractArray(frontmatter, 'testimonials');
  for (const t of testimonials) {
    if (t.name) {
      nodes.push({
        id: nodeId(page.slug, 'testimonial', t.name),
        type: 'testimonial',
        title: t.name,
        text: `${t.organization || ''}. ${t.quote || ''}`,
        page: page.slug,
        pageUrl,
        persona: t.name,
        avatar: t.avatar || null,
      });
    }
  }

  // FAQ items
  const faqItems = extractArray(frontmatter, 'faqItems');
  for (const f of faqItems) {
    if (f.question) {
      nodes.push({
        id: nodeId(page.slug, 'faq', f.question),
        type: 'faq',
        title: f.question,
        text: f.answer || '',
        page: page.slug,
        pageUrl,
      });
    }
  }

  // Lookbook items
  const lookbookItems = extractArray(frontmatter, 'lookbookItems');
  for (const l of lookbookItems) {
    if (l.title) {
      nodes.push({
        id: nodeId(page.slug, 'lookbook', l.title + ' ' + (l.subtitle || '')),
        type: 'lookbook',
        title: l.title,
        text: l.subtitle || '',
        page: page.slug,
        pageUrl,
        image: l.image || null,
      });
    }
  }

  // Looks (latest-trends-young-fashion)
  const looks = extractArray(frontmatter, 'looks');
  for (const l of looks) {
    if (l.title) {
      nodes.push({
        id: nodeId(page.slug, 'trend', l.title + ' ' + (l.subtitle || '')),
        type: 'trend',
        title: `${l.title}: ${l.subtitle || ''}`,
        text: l.description || '',
        page: page.slug,
        pageUrl,
        category: l.title || null,
        image: l.image || null,
      });
    }
  }

  // More items (products page)
  const moreItems = extractArray(frontmatter, 'moreItems');
  for (const m of moreItems) {
    if (m.title && m.description) {
      nodes.push({
        id: nodeId(page.slug, 'feature', m.title + '-' + m.description.slice(0, 30)),
        type: 'feature',
        title: m.title,
        text: m.description,
        page: page.slug,
        pageUrl,
        image: m.image || null,
      });
    }
  }

  // Gallery (only extract as a single node per gallery, not per image)
  const galleryImages = extractArray(frontmatter, 'galleryImages');
  if (galleryImages.length > 0) {
    const galleryText = galleryImages.map(g => g.alt || '').filter(Boolean).join(', ');
    const firstSrc = galleryImages[0].src || null;
    if (galleryText) {
      nodes.push({
        id: nodeId(page.slug, 'gallery', 'style-gallery'),
        type: 'gallery',
        title: 'Style Gallery',
        text: galleryText,
        page: page.slug,
        pageUrl,
        image: firstSrc,
      });
    }
  }

  // Inline HTML sections (h2/h3/h4 with paragraphs)
  const inlineSections = extractInlineSections(template, page.slug);
  // Filter out duplicates (titles already captured by Hero/CTA/arrays)
  const existingTitles = new Set(nodes.map(n => n.title.toLowerCase()));
  for (const section of inlineSections) {
    if (!existingTitles.has(section.title.toLowerCase())) {
      section.pageUrl = pageUrl;
      nodes.push(section);
      existingTitles.add(section.title.toLowerCase());
    }
  }

  return nodes;
}

function extractFromBlogPost(page) {
  const content = readBlogFile(page.file);
  if (!content) return [];

  // Split frontmatter
  const parts = content.split('---');
  if (parts.length < 3) return [];

  const fmBlock = parts[1];
  const body = parts.slice(2).join('---');

  // Parse YAML-like frontmatter
  const fm = {};
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (m) fm[m[1]] = m[2].replace(/^"|"$/g, '');
  }

  const cleanBody = stripMarkdown(body);
  const pageUrl = `${LIVE_BASE}${page.path}`;

  return [{
    id: nodeId(page.slug, 'blog', fm.title || page.slug),
    type: 'blog',
    title: fm.title || page.slug,
    text: truncate(`${fm.description || ''}. ${cleanBody}`, 2000),
    page: page.slug,
    pageUrl,
    category: fm.category || null,
    author: fm.author || null,
    image: fm.image || null,
  }];
}

function extractAllNodes() {
  const nodes = [];

  for (const page of PAGES.static) {
    const pageNodes = extractFromAstroPage(page);
    nodes.push(...pageNodes);
  }

  for (const page of PAGES.blog) {
    const pageNodes = extractFromBlogPost(page);
    nodes.push(...pageNodes);
  }

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set();
  const unique = [];
  for (const n of nodes) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      unique.push(n);
    }
  }

  return unique;
}

/* ─── Embedding Generation ─── */

async function generateEmbeddings(nodes) {
  const embPath = join(DATA_DIR, 'embeddings.json');
  let cached = {};
  if (!FORCE && existsSync(embPath)) {
    cached = JSON.parse(readFileSync(embPath, 'utf-8'));
  }

  // Check which nodes need embedding
  const toEmbed = [];
  const texts = [];
  for (const node of nodes) {
    const embText = truncate(`${node.title}. ${node.text}`, 2000);
    const hash = md5(embText);

    if (!FORCE && cached[node.id] && cached[node.id].hash === hash) {
      continue; // already cached with same content
    }

    toEmbed.push({ node, embText, hash });
    texts.push(embText);
  }

  if (toEmbed.length === 0) {
    console.log('  All embeddings cached');
    return cached;
  }

  if (!VOYAGE_KEY) {
    console.error('  VOYAGE_API_KEY not set in .env — cannot generate embeddings');
    process.exit(1);
  }

  console.log(`  Embedding ${toEmbed.length} texts via Voyage AI...`);

  // Batch in groups of 128 (Voyage limit)
  const batchSize = 128;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batchTexts = texts.slice(i, i + batchSize);
    const batchItems = toEmbed.slice(i, i + batchSize);

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOYAGE_KEY}`,
      },
      body: JSON.stringify({
        model: 'voyage-3-lite',
        input: batchTexts,
        input_type: 'document',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`  Voyage API error: HTTP ${response.status} — ${body.slice(0, 300)}`);
      process.exit(1);
    }

    const data = await response.json();

    for (let j = 0; j < batchItems.length; j++) {
      const item = batchItems[j];
      const embedding = data.data[j].embedding;
      cached[item.node.id] = {
        hash: item.hash,
        vector: embedding,
      };
    }

    console.log(`  Batch ${Math.floor(i / batchSize) + 1}: ${batchItems.length} embeddings`);
  }

  writeFileSync(embPath, JSON.stringify(cached, null, 2));
  console.log(`  Saved embeddings: ${Object.keys(cached).length} vectors`);

  return cached;
}

/* ─── Similarity Computation ─── */

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function computeSemanticEdges(nodes, embeddings) {
  const edges = [];
  const ids = nodes.map(n => n.id).filter(id => embeddings[id]);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(embeddings[ids[i]].vector, embeddings[ids[j]].vector);
      if (sim >= SIMILARITY_THRESHOLD) {
        edges.push({
          source: ids[i],
          target: ids[j],
          weight: Math.round(sim * 1000) / 1000,
          type: 'semantic',
        });
      }
    }
  }

  edges.sort((a, b) => b.weight - a.weight);
  return edges;
}

function computeStructuralEdges(nodes) {
  const edges = [];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // same-page edges (connect nodes on the same page)
  const byPage = {};
  for (const n of nodes) {
    if (!byPage[n.page]) byPage[n.page] = [];
    byPage[n.page].push(n);
  }
  for (const pageNodes of Object.values(byPage)) {
    // Only connect hero/cta to other nodes on same page (avoid O(n^2) within large pages)
    const anchors = pageNodes.filter(n => n.type === 'hero' || n.type === 'cta');
    const others = pageNodes.filter(n => n.type !== 'hero' && n.type !== 'cta');
    for (const a of anchors) {
      for (const o of others) {
        edges.push({ source: a.id, target: o.id, weight: 1, type: 'same-page' });
      }
    }
  }

  // same-persona edges (same person name across pages)
  const byPersona = {};
  for (const n of nodes) {
    if (n.persona) {
      const key = n.persona.toLowerCase();
      if (!byPersona[key]) byPersona[key] = [];
      byPersona[key].push(n);
    }
  }
  for (const group of Object.values(byPersona)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].page !== group[j].page) {
          edges.push({ source: group[i].id, target: group[j].id, weight: 1, type: 'same-persona' });
        }
      }
    }
  }

  // same-category edges (same category tag across pages)
  const byCat = {};
  for (const n of nodes) {
    if (n.category) {
      const key = n.category.toLowerCase();
      if (!byCat[key]) byCat[key] = [];
      byCat[key].push(n);
    }
  }
  for (const group of Object.values(byCat)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i].page !== group[j].page) {
          edges.push({ source: group[i].id, target: group[j].id, weight: 1, type: 'same-category' });
        }
      }
    }
  }

  // linked edges (ArticleCard href pointing to blog posts)
  const blogBySlug = {};
  for (const n of nodes) {
    if (n.type === 'blog') blogBySlug[n.page] = n;
  }
  for (const n of nodes) {
    if (n.href) {
      // Normalize href to slug
      const hrefSlug = 'blog-' + n.href.replace(/^\/blog\//, '');
      const target = blogBySlug[hrefSlug];
      if (target) {
        edges.push({ source: n.id, target: target.id, weight: 1, type: 'linked' });
      }
    }
  }

  return edges;
}

/* ─── Graph Assembly ─── */

function assembleGraph(nodes, semanticEdges, structuralEdges) {
  // Clean nodes for output (remove internal fields)
  const cleanNodes = nodes.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    text: n.text,
    page: n.page,
    pageUrl: n.pageUrl || null,
    image: n.image || null,
    avatar: n.avatar || null,
    category: n.category || null,
    persona: n.persona || null,
  }));

  const stats = {
    totalNodes: nodes.length,
    totalSemanticEdges: semanticEdges.length,
    totalStructuralEdges: structuralEdges.length,
    nodesByType: {},
    nodesByPage: {},
    avgSimilarity: 0,
  };

  for (const n of nodes) {
    stats.nodesByType[n.type] = (stats.nodesByType[n.type] || 0) + 1;
    stats.nodesByPage[n.page] = (stats.nodesByPage[n.page] || 0) + 1;
  }

  if (semanticEdges.length > 0) {
    stats.avgSimilarity = Math.round(
      semanticEdges.reduce((s, e) => s + e.weight, 0) / semanticEdges.length * 1000
    ) / 1000;
  }

  return {
    generatedAt: new Date().toISOString(),
    similarityThreshold: SIMILARITY_THRESHOLD,
    nodes: cleanNodes,
    semanticEdges,
    structuralEdges,
    stats,
  };
}

/* ─── Report Generation ─── */

function generateReport(graph) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const TYPE_COLORS = {
    hero: '#3B63FB',
    article: '#2563EB',
    trend: '#7C3AED',
    testimonial: '#EA580C',
    persona: '#D97706',
    faq: '#059669',
    lookbook: '#EC4899',
    feature: '#6366F1',
    cta: '#64748B',
    blog: '#DC2626',
    gallery: '#14B8A6',
  };

  const TYPE_ICONS = {
    hero: '\u2605',
    article: '\u25A1',
    trend: '\u2191',
    testimonial: '\u201C',
    persona: '\u263A',
    faq: '?',
    lookbook: '\u25CB',
    feature: '\u2606',
    cta: '\u279C',
    blog: '\u270E',
    gallery: '\u25A3',
  };

  const EDGE_COLORS = {
    'same-page': '#94A3B8',
    'same-persona': '#D97706',
    'same-category': '#059669',
    'linked': '#3B63FB',
  };

  const LIVE_BASE = 'https://wknd-trendsetters.pages.dev';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Content Neural Network \u2014 WKND Trendsetters</title>
<style>
  @font-face { font-family: 'Source Sans Pro'; src: url('../public/fonts/SourceSansPro-Regular.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Source Sans Pro'; src: url('../public/fonts/SourceSansPro-SemiBold.woff2') format('woff2'); font-weight: 600; font-style: normal; font-display: swap; }
  @font-face { font-family: 'Source Sans Pro'; src: url('../public/fonts/SourceSansPro-Bold.woff2') format('woff2'); font-weight: 700; font-style: normal; font-display: swap; }

  :root {
    --bg:             #F8F8F8;
    --bg-2:           #FFFFFF;
    --primary:        #3B63FB;
    --primary-fg:     #FFFFFF;
    --fg:             #292929;
    --fg-heading:     #131313;
    --fg-muted:       #717171;
    --border:         #E1E1E1;
    --border-subtle:  #f0f0f0;
    --shadow-emphasized: 0 2px 8px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.08);
    --shadow-elevated:  0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.08);
    --font: "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font); background: var(--bg); color: var(--fg); line-height: 1.5; font-size: 14px; overflow: hidden; height: 100vh; display: flex; flex-direction: column; }

  :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  /* --- Header --- */
  .header { background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 12px 24px; flex-shrink: 0; }
  .header-inner { max-width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 20px; font-weight: 700; color: var(--fg-heading); }
  .subtitle { color: var(--fg-muted); font-size: 13px; }
  .back-link { font-size: 14px; color: var(--primary); text-decoration: none; font-weight: 600; }
  .back-link:hover { color: var(--fg-heading); }

  /* --- Controls Bar --- */
  .controls { background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 10px 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
  .search-box { padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: var(--font); width: 200px; }
  .search-box:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 2px rgba(59,99,251,0.2); }

  .filter-group { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
  .filter-label { font-size: 12px; font-weight: 600; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 4px; }

  .pill { padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); background: var(--bg); color: var(--fg-muted); cursor: pointer; transition: all 120ms; }
  .pill.active { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
  .pill:hover:not(.active) { border-color: var(--primary); color: var(--primary); }

  .edge-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fg-muted); cursor: pointer; }
  .edge-toggle input { accent-color: var(--primary); }

  .slider-group { display: flex; align-items: center; gap: 6px; }
  .slider-group label { font-size: 12px; color: var(--fg-muted); font-weight: 600; }
  .slider-group input[type=range] { width: 100px; accent-color: var(--primary); }
  .slider-val { font-size: 12px; font-weight: 700; color: var(--fg-heading); min-width: 32px; }

  .btn-reset { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: var(--bg); border: 1px solid var(--border); color: var(--fg-muted); cursor: pointer; }
  .btn-reset:hover { border-color: var(--primary); color: var(--primary); }

  /* --- Graph Area --- */
  .graph-area { flex: 1; position: relative; overflow: hidden; background: var(--bg-2); }
  .graph-area::before {
    content: '';
    position: absolute; inset: 0;
    background-image: radial-gradient(circle, var(--border) 0.75px, transparent 0.75px);
    background-size: 32px 32px;
    opacity: 0.4;
    pointer-events: none;
    z-index: 0;
  }
  .graph-area svg { position: absolute; inset: 0; z-index: 1; }

  /* --- Loading overlay --- */
  .loading-overlay {
    position: absolute; inset: 0; z-index: 3;
    background: var(--bg-2);
    display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px;
    transition: opacity 400ms ease-out;
  }
  .loading-overlay.hidden { opacity: 0; pointer-events: none; }
  .loading-bar { width: 200px; height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; }
  .loading-bar-inner { height: 100%; width: 30%; background: var(--primary); border-radius: 2px; animation: shimmer 1.2s ease-in-out infinite; }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
  .loading-text { font-size: 13px; color: var(--fg-muted); font-weight: 600; }

  /* --- Zoom Controls --- */
  .zoom-controls {
    position: absolute; bottom: 20px; left: 20px; z-index: 5;
    display: flex; flex-direction: column; gap: 0;
    background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px;
    box-shadow: var(--shadow-emphasized); overflow: hidden;
  }
  .zoom-btn {
    width: 36px; height: 36px; border: none; background: var(--bg-2);
    font-size: 18px; font-weight: 700; color: var(--fg-muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 120ms;
  }
  .zoom-btn:hover { background: var(--bg); color: var(--primary); }
  .zoom-btn:active { background: var(--border-subtle); }
  .zoom-btn + .zoom-btn { border-top: 1px solid var(--border-subtle); }
  .zoom-level {
    width: 36px; height: 24px; border-top: 1px solid var(--border-subtle);
    font-size: 10px; font-weight: 700; color: var(--fg-muted);
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
  }

  /* --- Detail Panel --- */
  .detail-panel {
    position: absolute; top: 0; right: 0; bottom: 0; width: 360px;
    background: var(--bg-2); border-left: 1px solid var(--border);
    box-shadow: var(--shadow-elevated);
    z-index: 10; transform: translateX(100%);
    transition: transform 250ms ease-out;
    overflow-y: auto;
    display: flex; flex-direction: column;
  }
  .detail-panel.open { transform: translateX(0); }

  .detail-hero-img {
    width: 100%; height: 160px; object-fit: cover; display: block;
    flex-shrink: 0;
  }
  .detail-hero-gradient {
    width: 100%; height: 80px; flex-shrink: 0;
    display: flex; align-items: flex-end; padding: 12px 20px;
  }

  .detail-header {
    padding: 16px 20px 12px; border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0; position: relative;
  }
  .detail-close { position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.9); border: none; font-size: 16px; cursor: pointer; color: var(--fg-muted); padding: 4px 8px; border-radius: 4px; z-index: 2; }
  .detail-close:hover { color: var(--fg-heading); background: white; }

  .detail-badges { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
  .detail-type { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.04em; }
  .detail-page-badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: var(--fg-muted); background: var(--bg); border: 1px solid var(--border); }
  .detail-title { font-size: 18px; font-weight: 700; color: var(--fg-heading); margin-bottom: 4px; padding-right: 28px; }

  .detail-text { font-size: 13px; color: var(--fg); line-height: 1.55; padding: 12px 20px; background: var(--bg); border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }

  .detail-actions { padding: 12px 20px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
  .btn-view-site {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 20px; border-radius: 8px;
    background: var(--primary); color: white;
    font-size: 13px; font-weight: 600; font-family: var(--font);
    text-decoration: none; border: none; cursor: pointer;
    transition: all 120ms;
  }
  .btn-view-site:hover { background: #2a4fd9; }
  .btn-view-site svg { width: 14px; height: 14px; }

  /* --- Navigation breadcrumb --- */
  .nav-trail {
    display: flex; align-items: center; gap: 4px; padding: 8px 20px;
    border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
    background: var(--bg); min-height: 32px; flex-wrap: wrap;
  }
  .nav-trail:empty { display: none; }
  .trail-crumb {
    font-size: 11px; font-weight: 600; color: var(--primary); cursor: pointer;
    padding: 2px 8px; border-radius: 4px; background: rgba(59,99,251,0.08);
    white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;
    transition: all 120ms; border: none; font-family: var(--font);
  }
  .trail-crumb:hover { background: rgba(59,99,251,0.16); }
  .trail-crumb.current { background: var(--primary); color: white; cursor: default; }
  .trail-sep { color: var(--fg-muted); font-size: 10px; }

  /* --- Connections list --- */
  .detail-connections { flex: 1; overflow-y: auto; padding: 0; }
  .conn-section { padding: 0; }
  .conn-section-header {
    position: sticky; top: 0; z-index: 2;
    padding: 8px 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; background: var(--bg); color: var(--fg-muted);
    border-bottom: 1px solid var(--border-subtle);
    display: flex; align-items: center; gap: 6px;
  }
  .conn-section-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .conn-section-line { width: 12px; height: 2px; border-radius: 1px; flex-shrink: 0; }
  .conn-section-count { font-weight: 400; color: #b0b0b0; }
  .conn-item {
    padding: 8px 20px; border-bottom: 1px solid var(--border-subtle);
    display: flex; align-items: center; gap: 10px;
    cursor: pointer; transition: background 100ms;
  }
  .conn-item:hover { background: rgba(59,99,251,0.05); }
  .conn-thumb {
    width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
    background: var(--border-subtle);
  }
  .conn-thumb-placeholder {
    width: 40px; height: 40px; border-radius: 6px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: white;
  }
  .conn-info { flex: 1; min-width: 0; }
  .conn-title { font-size: 13px; font-weight: 600; color: var(--fg-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conn-meta { font-size: 11px; color: var(--fg-muted); margin-top: 1px; }
  .conn-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
  .conn-weight { font-size: 11px; font-weight: 700; border-radius: 4px; padding: 2px 7px; }
  .conn-nav-icon { font-size: 14px; color: var(--fg-muted); transition: transform 120ms; }
  .conn-item:hover .conn-nav-icon { transform: translateX(2px); color: var(--primary); }

  /* --- Detail footer --- */
  .detail-footer { padding: 12px 20px; border-top: 1px solid var(--border-subtle); font-size: 11px; color: var(--fg-muted); flex-shrink: 0; background: var(--bg); }

  /* --- Stats Bar --- */
  .stats-bar {
    background: var(--bg-2); border-top: 1px solid var(--border);
    padding: 6px 24px; display: flex; justify-content: space-between; align-items: center;
    flex-wrap: wrap; gap: 8px; flex-shrink: 0;
  }
  .legend { display: flex; gap: 12px; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--fg-muted); font-weight: 500; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
  .legend-line { width: 16px; height: 2px; border-radius: 1px; }
  .stats { font-size: 12px; color: var(--fg-muted); }

  /* --- Animations --- */
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }
  @keyframes search-pulse {
    0%, 100% { stroke-opacity: 0.4; }
    50% { stroke-opacity: 1; }
  }

  /* --- Responsive --- */
  @media (max-width: 768px) {
    .controls { padding: 8px 12px; gap: 8px; }
    .search-box { width: 140px; }
    .detail-panel { width: 100%; }
    .stats-bar { padding: 6px 12px; }
    .zoom-controls { bottom: 12px; left: 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
    .loading-bar-inner { animation: none; width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div>
      <h1>Content Neural Network</h1>
      <span class="subtitle">${graph.stats.totalNodes} content pieces \u00b7 ${graph.semanticEdges.length} semantic + ${graph.structuralEdges.length} structural edges \u2014 ${date}</span>
    </div>
    <a href="hub.html" class="back-link">\u2190 Reports Hub</a>
  </div>
</div>

<div class="controls" id="controls">
  <input type="text" class="search-box" id="search" placeholder="Search content..." aria-label="Search content">

  <div class="filter-group" id="type-filters">
    <span class="filter-label">Type</span>
  </div>

  <div class="filter-group">
    <span class="filter-label">Edges</span>
    <label class="edge-toggle"><input type="checkbox" data-edge="semantic" checked> Semantic</label>
    <label class="edge-toggle"><input type="checkbox" data-edge="same-page"> Same page</label>
    <label class="edge-toggle"><input type="checkbox" data-edge="same-persona" checked> Persona</label>
    <label class="edge-toggle"><input type="checkbox" data-edge="same-category" checked> Category</label>
    <label class="edge-toggle"><input type="checkbox" data-edge="linked" checked> Linked</label>
  </div>

  <div class="slider-group">
    <label for="threshold">Sim \u2265</label>
    <input type="range" id="threshold" min="0.30" max="0.80" step="0.01" value="${DISPLAY_THRESHOLD}">
    <span class="slider-val" id="threshold-val">${DISPLAY_THRESHOLD}</span>
    <span class="slider-val" id="edge-count" style="color:var(--fg-muted);font-weight:400"></span>
  </div>

  <button class="btn-reset" id="btn-reset" title="Reset zoom & selection">Reset</button>
</div>

<div class="graph-area" id="graph-area">
  <div class="loading-overlay" id="loading">
    <div class="loading-bar"><div class="loading-bar-inner"></div></div>
    <div class="loading-text">Computing layout\u2026</div>
  </div>
  <svg id="graph-svg"></svg>

  <div class="zoom-controls">
    <button class="zoom-btn" id="zoom-in" title="Zoom in" aria-label="Zoom in">+</button>
    <button class="zoom-btn" id="zoom-out" title="Zoom out" aria-label="Zoom out">\u2212</button>
    <div class="zoom-level" id="zoom-level">1x</div>
    <button class="zoom-btn" id="zoom-fit" title="Fit all nodes" aria-label="Fit all visible nodes" style="font-size:13px">\u2922</button>
  </div>

  <div class="detail-panel" id="detail-panel">
    <div id="detail-hero-area"></div>
    <div class="detail-header">
      <button class="detail-close" id="detail-close" aria-label="Close panel">\u2715</button>
      <div id="detail-header-content"></div>
    </div>
    <div id="detail-text-area"></div>
    <div id="detail-actions-area"></div>
    <div class="nav-trail" id="nav-trail"></div>
    <div class="detail-connections" id="detail-connections"></div>
    <div class="detail-footer" id="detail-footer"></div>
  </div>
</div>

<div class="stats-bar">
  <div class="legend">
    ${Object.entries(TYPE_COLORS).map(([t, c]) => `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${t}</div>`).join('\n    ')}
    <div class="legend-item"><div class="legend-line" style="background:#94A3B8"></div>same-page</div>
    <div class="legend-item"><div class="legend-line" style="background:#D97706;height:2px;border-top:1px dashed #D97706;background:none"></div>persona</div>
    <div class="legend-item"><div class="legend-line" style="background:#059669"></div>category</div>
    <div class="legend-item"><div class="legend-line" style="background:#3B63FB"></div>linked</div>
  </div>
  <div class="stats" id="stats-text">${graph.stats.totalNodes} nodes \u00b7 ${graph.semanticEdges.length + graph.structuralEdges.length} edges \u00b7 avg similarity ${graph.stats.avgSimilarity}</div>
</div>

<script type="module">
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const GRAPH_DATA = ${JSON.stringify(graph)};
const TYPE_COLORS = ${JSON.stringify(TYPE_COLORS)};
const TYPE_ICONS = ${JSON.stringify(TYPE_ICONS)};
const EDGE_COLORS = ${JSON.stringify(EDGE_COLORS)};
const LIVE_BASE = '${LIVE_BASE}';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const container = document.getElementById('graph-area');
const svg = d3.select('#graph-svg');
const width = container.clientWidth;
const height = container.clientHeight;
svg.attr('width', width).attr('height', height);

const g = svg.append('g');

/* --- State --- */
let activeTypes = new Set(Object.keys(TYPE_COLORS));
let activeEdgeTypes = new Set(['semantic', 'same-persona', 'same-category', 'linked']);
let simThreshold = ${DISPLAY_THRESHOLD};
let searchQuery = '';
let selectedNode = null;
let navHistory = [];
let currentZoom = 1;

/* --- Nodes & edges --- */
const nodes = GRAPH_DATA.nodes.map(n => ({ ...n }));
const allEdges = [
  ...GRAPH_DATA.semanticEdges.map(e => ({ ...e })),
  ...GRAPH_DATA.structuralEdges.map(e => ({ ...e })),
];

const connCount = {};
nodes.forEach(n => { connCount[n.id] = 0; });
allEdges.forEach(e => {
  connCount[e.source] = (connCount[e.source] || 0) + 1;
  connCount[e.target] = (connCount[e.target] || 0) + 1;
});

const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

const adjacency = {};
nodes.forEach(n => { adjacency[n.id] = []; });
allEdges.forEach(e => {
  adjacency[e.source] = adjacency[e.source] || [];
  adjacency[e.target] = adjacency[e.target] || [];
  adjacency[e.source].push(e);
  adjacency[e.target].push(e);
});

/* --- Scales --- */
const maxConn = Math.max(...Object.values(connCount), 1);
const radiusScale = d3.scaleSqrt().domain([0, maxConn]).range([8, 24]);

/* --- Helpers --- */
function eid(e, prop) { return typeof e[prop] === 'object' ? e[prop].id : e[prop]; }

function nodeImage(n) {
  const img = n.image || n.avatar;
  if (!img) return null;
  return LIVE_BASE + img;
}

function isNodeVisible(n) {
  if (!activeTypes.has(n.type)) return false;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q) || n.page.toLowerCase().includes(q);
  }
  return true;
}

function isEdgeVisible(e) {
  const srcNode = nodeById[eid(e, 'source')];
  const tgtNode = nodeById[eid(e, 'target')];
  if (!srcNode || !tgtNode) return false;
  if (!isNodeVisible(srcNode) || !isNodeVisible(tgtNode)) return false;
  if (e.type === 'semantic') return activeEdgeTypes.has('semantic') && e.weight >= simThreshold;
  return activeEdgeTypes.has(e.type);
}

function getConnectedIds(nodeId) {
  const ids = new Set([nodeId]);
  (adjacency[nodeId] || []).forEach(e => {
    if (isEdgeVisible(e)) {
      ids.add(eid(e, 'source'));
      ids.add(eid(e, 'target'));
    }
  });
  return ids;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function countVisibleEdges() {
  return allEdges.filter(isEdgeVisible).length;
}

/* --- SVG Defs --- */
const defs = svg.append('defs');

// Glow filter
const glowFilter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
glowFilter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

// Edge glow filter
const edgeGlow = defs.append('filter').attr('id', 'edge-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
edgeGlow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
edgeGlow.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

// ClipPath for each node (image circles)
nodes.forEach(n => {
  defs.append('clipPath').attr('id', 'clip-' + n.id.replace(/[^a-zA-Z0-9_-]/g, '_'))
    .append('circle').attr('r', radiusScale(connCount[n.id] || 0));
});

/* --- Build SVG layers --- */
const edgeG = g.append('g').attr('class', 'edges');
const nodeG = g.append('g').attr('class', 'nodes');
const cardG = g.append('g').attr('class', 'cards');
const labelG = g.append('g').attr('class', 'labels');
const ringG = g.append('g').attr('class', 'rings');

/* --- Edges --- */
const edgeDashPatterns = {
  'semantic': 'none',
  'same-page': '4,4',
  'same-persona': '8,4',
  'same-category': '2,6',
  'linked': 'none',
};

let linkElements = edgeG.selectAll('line')
  .data(allEdges)
  .join('line')
  .attr('stroke', d => d.type === 'semantic' ? '#CBD5E1' : (EDGE_COLORS[d.type] || '#CBD5E1'))
  .attr('stroke-width', d => d.type === 'semantic' ? Math.max(0.5, d.weight * 3) : 1.5)
  .attr('stroke-opacity', d => d.type === 'semantic' ? Math.max(0.1, (d.weight - 0.4) * 1.5) : 0.4)
  .attr('stroke-dasharray', d => edgeDashPatterns[d.type] || 'none')
  .style('display', d => isEdgeVisible(d) ? null : 'none');

/* --- Nodes (groups with image circles) --- */
let nodeGroups = nodeG.selectAll('g.node-group')
  .data(nodes)
  .join('g')
  .attr('class', 'node-group')
  .attr('cursor', 'pointer')
  .style('display', d => isNodeVisible(d) ? null : 'none');

// Outer ring (type color)
nodeGroups.append('circle')
  .attr('class', 'node-ring')
  .attr('r', d => radiusScale(connCount[d.id] || 0) + 2)
  .attr('fill', 'none')
  .attr('stroke', d => TYPE_COLORS[d.type] || '#94A3B8')
  .attr('stroke-width', 2)
  .attr('opacity', 0.7);

// Image or fallback circle
nodeGroups.each(function(d) {
  const group = d3.select(this);
  const r = radiusScale(connCount[d.id] || 0);
  const imgUrl = nodeImage(d);
  const clipId = 'clip-' + d.id.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (imgUrl) {
    // Background circle (shows while image loads)
    group.append('circle')
      .attr('class', 'node-bg')
      .attr('r', r)
      .attr('fill', TYPE_COLORS[d.type] || '#94A3B8');
    // Image clipped to circle
    group.append('image')
      .attr('class', 'node-img')
      .attr('href', imgUrl)
      .attr('x', -r).attr('y', -r)
      .attr('width', r * 2).attr('height', r * 2)
      .attr('clip-path', 'url(#' + clipId + ')')
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .on('error', function() { d3.select(this).remove(); });
  } else {
    // Colored circle with initial
    group.append('circle')
      .attr('class', 'node-bg')
      .attr('r', r)
      .attr('fill', TYPE_COLORS[d.type] || '#94A3B8');
    // Letter initial
    group.append('text')
      .attr('class', 'node-initial')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'white')
      .attr('font-size', r * 0.9)
      .attr('font-weight', 700)
      .attr('font-family', 'var(--font)')
      .attr('pointer-events', 'none')
      .text(TYPE_ICONS[d.type] || d.title.charAt(0).toUpperCase());
  }
});

/* --- Labels --- */
let labelElements = labelG.selectAll('text')
  .data(nodes)
  .join('text')
  .text(d => d.title.length > 22 ? d.title.slice(0, 20) + '\\u2026' : d.title)
  .attr('font-size', 10)
  .attr('font-family', 'var(--font)')
  .attr('font-weight', 600)
  .attr('fill', '#555')
  .attr('text-anchor', 'middle')
  .attr('dy', d => radiusScale(connCount[d.id] || 0) + 14)
  .attr('pointer-events', 'none')
  .style('display', d => isNodeVisible(d) ? null : 'none');

/* --- foreignObject card layer (for zoom > 3x) --- */
let cardElements = cardG.selectAll('foreignObject.mini-card')
  .data(nodes)
  .join('foreignObject')
  .attr('class', 'mini-card')
  .attr('width', 160).attr('height', 100)
  .attr('x', -80).attr('y', -50)
  .style('display', 'none')
  .style('pointer-events', 'none')
  .html(d => {
    const imgUrl = nodeImage(d);
    const color = TYPE_COLORS[d.type] || '#94A3B8';
    const shortTitle = d.title.length > 30 ? d.title.slice(0, 28) + '\\u2026' : d.title;
    return '<div style="width:160px;height:100px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);border-left:3px solid ' + color + ';display:flex;flex-direction:column;font-family:Source Sans Pro,sans-serif">' +
      (imgUrl ? '<img src="' + imgUrl + '" style="width:100%;height:48px;object-fit:cover" onerror="this.style.display=\\'none\\'">' : '<div style="height:48px;background:linear-gradient(135deg,' + color + '22,' + color + '44)"></div>') +
      '<div style="padding:4px 8px;flex:1;min-height:0">' +
        '<div style="font-size:11px;font-weight:700;color:#131313;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(shortTitle) + '</div>' +
        '<div style="display:flex;gap:4px;margin-top:2px">' +
          '<span style="font-size:9px;padding:1px 5px;border-radius:9999px;background:' + color + ';color:white;font-weight:600;text-transform:uppercase">' + d.type + '</span>' +
          '<span style="font-size:9px;padding:1px 5px;border-radius:9999px;background:#f0f0f0;color:#717171;font-weight:500">' + d.page + '</span>' +
        '</div>' +
      '</div></div>';
  });

// Selection ring (initially hidden)
let selectionRing = ringG.append('circle')
  .attr('r', 0).attr('fill', 'none')
  .attr('stroke', 'var(--primary)').attr('stroke-width', 3)
  .attr('stroke-dasharray', '4 2').attr('opacity', 0)
  .attr('filter', 'url(#glow)');

// Search highlight rings
let searchRings = ringG.selectAll('circle.search-ring')
  .data(nodes)
  .join('circle')
  .attr('class', 'search-ring')
  .attr('r', d => radiusScale(connCount[d.id] || 0) + 6)
  .attr('fill', 'none')
  .attr('stroke', '#3B63FB')
  .attr('stroke-width', 2)
  .attr('opacity', 0);

/* --- Force simulation --- */
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(allEdges).id(d => d.id).distance(d => {
    if (d.type === 'semantic') return Math.max(60, 200 * (1 - d.weight));
    return 120;
  }).strength(d => {
    if (d.type === 'semantic') return d.weight * 0.3;
    return 0.1;
  }))
  .force('charge', d3.forceManyBody().strength(-180))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('x', d3.forceX(width / 2).strength(0.03))
  .force('y', d3.forceY(height / 2).strength(0.03))
  .force('collide', d3.forceCollide().radius(d => radiusScale(connCount[d.id] || 0) + 10))
  .alphaDecay(0.02)
  .on('tick', ticked);

function ticked() {
  linkElements
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  nodeGroups.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');
  labelElements.attr('x', d => d.x).attr('y', d => d.y);
  cardElements.attr('x', d => d.x - 80).attr('y', d => d.y - 50);
  searchRings.attr('cx', d => d.x).attr('cy', d => d.y);
  if (selectedNode) {
    selectionRing.attr('cx', selectedNode.x).attr('cy', selectedNode.y);
  }
}

/* --- Adaptive zoom rendering --- */
function updateZoomLevel(k) {
  currentZoom = k;
  const showCards = k > 3;
  const showLabels = k <= 3;

  nodeGroups.style('display', d => {
    if (!isNodeVisible(d)) return 'none';
    return showCards && !selectedNode ? 'none' : null;
  });
  labelElements.style('display', d => {
    if (!isNodeVisible(d)) return 'none';
    return showLabels ? null : 'none';
  });
  cardElements.style('display', d => {
    if (!isNodeVisible(d)) return 'none';
    return showCards && !selectedNode ? null : 'none';
  }).style('pointer-events', showCards && !selectedNode ? 'all' : 'none');

  // Label font size adapts to zoom
  if (k >= 1.5 && k <= 3) {
    labelElements.attr('font-size', 10);
  } else if (k < 1.5) {
    labelElements.attr('font-size', Math.max(8, 10 / Math.max(k, 0.3)));
  }
}

/* --- Zoom & pan --- */
const zoomBehavior = d3.zoom()
  .scaleExtent([0.15, 8])
  .on('zoom', (event) => {
    g.attr('transform', event.transform);
    const k = event.transform.k;
    document.getElementById('zoom-level').textContent = k.toFixed(1) + 'x';
    updateZoomLevel(k);
    updateStatsBar();
  });

svg.call(zoomBehavior);

document.getElementById('zoom-in').addEventListener('click', () => {
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
});
document.getElementById('zoom-out').addEventListener('click', () => {
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 1 / 1.5);
});
document.getElementById('zoom-fit').addEventListener('click', zoomToFit);
document.getElementById('btn-reset').addEventListener('click', () => {
  clearSelection();
  svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
});

function zoomToFit() {
  const visibleNodes = nodes.filter(isNodeVisible);
  if (visibleNodes.length === 0) return;
  const xs = visibleNodes.map(n => n.x);
  const ys = visibleNodes.map(n => n.y);
  const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40;
  const x1 = Math.max(...xs) + 40, y1 = Math.max(...ys) + 40;
  const bw = x1 - x0, bh = y1 - y0;
  const scale = Math.min(width / bw, height / bh, 3) * 0.9;
  const tx = width / 2 - (x0 + bw / 2) * scale;
  const ty = height / 2 - (y0 + bh / 2) * scale;
  const dur = prefersReducedMotion ? 0 : 600;
  svg.transition().duration(dur).call(
    zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale)
  );
}

function panToNode(node, targetScale) {
  const k = targetScale || 3.5;
  const tx = width / 2 - node.x * k;
  const ty = height / 2 - node.y * k;
  const dur = prefersReducedMotion ? 0 : 600;
  svg.transition().duration(dur).call(
    zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k)
  );
}

/* --- Drag --- */
const drag = d3.drag()
  .on('start', (event, d) => {
    if (!event.active) simulation.alphaTarget(0.1).restart();
    d.fx = d.x; d.fy = d.y;
  })
  .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
  .on('end', (event, d) => {
    if (!event.active) simulation.alphaTarget(0);
  });

nodeGroups.call(drag);
nodeGroups.on('dblclick', (event, d) => {
  d.fx = null; d.fy = null;
  simulation.alphaTarget(0.05).restart();
  setTimeout(() => simulation.alphaTarget(0), 500);
});

/* --- Hover --- */
nodeGroups.on('mouseenter', (event, d) => {
  if (selectedNode) return;
  applyHighlight(d.id);
});
nodeGroups.on('mouseleave', () => {
  if (selectedNode) return;
  clearHighlight();
});

function applyHighlight(nodeId) {
  const connected = getConnectedIds(nodeId);
  nodeGroups
    .attr('opacity', n => connected.has(n.id) ? 1 : 0.08);
  nodeGroups.select('.node-ring')
    .attr('stroke-width', n => n.id === nodeId ? 3 : 2);
  labelElements.attr('opacity', n => connected.has(n.id) ? 1 : 0.05);
  linkElements
    .attr('stroke-opacity', e => {
      const s = eid(e, 'source'), t = eid(e, 'target');
      if (s === nodeId || t === nodeId) return 0.9;
      return 0.03;
    })
    .attr('stroke-width', e => {
      const s = eid(e, 'source'), t = eid(e, 'target');
      if (s === nodeId || t === nodeId) {
        return e.type === 'semantic' ? Math.max(2, e.weight * 5) : 3;
      }
      return e.type === 'semantic' ? Math.max(0.5, e.weight * 3) : 1.5;
    })
    .attr('stroke', e => {
      const s = eid(e, 'source'), t = eid(e, 'target');
      if (s === nodeId || t === nodeId) {
        if (e.type === 'semantic') return '#3B63FB';
        return EDGE_COLORS[e.type] || '#CBD5E1';
      }
      return e.type === 'semantic' ? '#CBD5E1' : (EDGE_COLORS[e.type] || '#CBD5E1');
    })
    .attr('filter', e => {
      const s = eid(e, 'source'), t = eid(e, 'target');
      return (s === nodeId || t === nodeId) ? 'url(#edge-glow)' : 'none';
    });
}

function clearHighlight() {
  nodeGroups.attr('opacity', 1);
  nodeGroups.select('.node-ring').attr('stroke-width', 2);
  labelElements.attr('opacity', 1);
  linkElements
    .attr('stroke', d => d.type === 'semantic' ? '#CBD5E1' : (EDGE_COLORS[d.type] || '#CBD5E1'))
    .attr('stroke-width', d => d.type === 'semantic' ? Math.max(0.5, d.weight * 3) : 1.5)
    .attr('stroke-opacity', d => d.type === 'semantic' ? Math.max(0.1, (d.weight - 0.4) * 1.5) : 0.4)
    .attr('filter', 'none');
}

/* --- Selection --- */
function selectNode(d, addToHistory) {
  selectedNode = d;

  if (addToHistory !== false) {
    navHistory = navHistory.filter(n => n.id !== d.id);
    navHistory.push(d);
    if (navHistory.length > 8) navHistory.shift();
  }

  // Ensure circle nodes visible at zoomed-in level
  nodeGroups.style('display', n => isNodeVisible(n) ? null : 'none');
  cardElements.style('display', 'none').style('pointer-events', 'none');
  labelElements.style('display', n => isNodeVisible(n) ? null : 'none');

  applyHighlight(d.id);

  // Pulse connected nodes
  if (!prefersReducedMotion) {
    const connected = getConnectedIds(d.id);
    nodeGroups.filter(n => connected.has(n.id) && n.id !== d.id)
      .transition().duration(200)
      .attr('transform', n => 'translate(' + n.x + ',' + n.y + ') scale(1.15)')
      .transition().duration(200)
      .attr('transform', n => 'translate(' + n.x + ',' + n.y + ') scale(1)');
  }

  // Selection ring
  const r = radiusScale(connCount[d.id] || 0);
  selectionRing
    .attr('cx', d.x).attr('cy', d.y)
    .attr('r', r + 6).attr('opacity', 1)
    .attr('stroke', TYPE_COLORS[d.type] || 'var(--primary)');

  panToNode(d, 3.5);
  showDetail(d);
}

function clearSelection() {
  selectedNode = null;
  navHistory = [];
  selectionRing.attr('opacity', 0);
  clearHighlight();
  updateZoomLevel(currentZoom);
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('nav-trail').innerHTML = '';
}

/* --- Click handlers --- */
nodeGroups.on('click', (event, d) => {
  event.stopPropagation();
  selectNode(d);
});
// Card click handler (for zoom > 3x mode)
cardElements.on('click', (event, d) => {
  event.stopPropagation();
  selectNode(d);
});

svg.on('click', () => { clearSelection(); });

document.getElementById('detail-close').addEventListener('click', clearSelection);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') clearSelection();
});

/* --- Detail panel --- */
const detailPanel = document.getElementById('detail-panel');
const detailHeroArea = document.getElementById('detail-hero-area');
const detailHeaderContent = document.getElementById('detail-header-content');
const detailTextArea = document.getElementById('detail-text-area');
const detailActionsArea = document.getElementById('detail-actions-area');
const detailConns = document.getElementById('detail-connections');
const detailFooter = document.getElementById('detail-footer');
const navTrail = document.getElementById('nav-trail');

function showDetail(d) {
  const color = TYPE_COLORS[d.type] || '#94A3B8';
  const imgUrl = nodeImage(d);

  // Hero image or gradient
  if (imgUrl) {
    detailHeroArea.innerHTML = '<img class="detail-hero-img" src="' + imgUrl + '" alt="" onerror="this.outerHTML=\\'<div class=detail-hero-gradient style=background:linear-gradient(135deg,' + color + '22,' + color + '55)></div>\\'">';
  } else {
    detailHeroArea.innerHTML = '<div class="detail-hero-gradient" style="background:linear-gradient(135deg,' + color + '22,' + color + '55)"></div>';
  }

  // Header
  detailHeaderContent.innerHTML =
    '<div class="detail-badges">' +
      '<span class="detail-type" style="background:' + color + '">' + escHtml(d.type) + '</span>' +
      '<span class="detail-page-badge">' + escHtml(d.page) + '</span>' +
      (d.category ? '<span class="detail-page-badge">' + escHtml(d.category) + '</span>' : '') +
    '</div>' +
    '<div class="detail-title">' + escHtml(d.title) + '</div>';

  // Text preview
  if (d.text) {
    const preview = d.text.length > 200 ? d.text.slice(0, 200) + '\\u2026' : d.text;
    detailTextArea.innerHTML = '<div class="detail-text">' + escHtml(preview) + '</div>';
  } else {
    detailTextArea.innerHTML = '';
  }

  // "View on site" button
  if (d.pageUrl) {
    detailActionsArea.innerHTML =
      '<div class="detail-actions">' +
        '<a class="btn-view-site" href="' + escHtml(d.pageUrl) + '" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3H3v10h10v-3M9 2h5v5M7 9l7-7"/></svg>' +
          'View on site' +
        '</a>' +
      '</div>';
  } else {
    detailActionsArea.innerHTML = '';
  }

  renderTrail();

  // Find visible connections
  const connections = [];
  const seen = new Set();
  (adjacency[d.id] || []).forEach(e => {
    if (!isEdgeVisible(e)) return;
    const otherId = eid(e, 'source') === d.id ? eid(e, 'target') : eid(e, 'source');
    if (seen.has(otherId + '|' + e.type)) return;
    seen.add(otherId + '|' + e.type);
    const other = nodeById[otherId];
    if (other) connections.push({ node: other, edge: e });
  });

  // Group by edge type
  const groups = {};
  connections.forEach(c => {
    const t = c.edge.type;
    if (!groups[t]) groups[t] = [];
    groups[t].push(c);
  });
  for (const arr of Object.values(groups)) {
    arr.sort((a, b) => (b.edge.weight || 0) - (a.edge.weight || 0));
  }

  const typeOrder = ['semantic', 'linked', 'same-persona', 'same-category', 'same-page'];
  const typeLabels = {
    semantic: 'Semantic similarity',
    linked: 'Linked (href)',
    'same-persona': 'Same persona',
    'same-category': 'Same category',
    'same-page': 'Same page',
  };

  let connHtml = '';
  for (const t of typeOrder) {
    const items = groups[t];
    if (!items || items.length === 0) continue;
    const edgeColor = t === 'semantic' ? '#3B63FB' : (EDGE_COLORS[t] || '#CBD5E1');
    const indicator = t === 'semantic'
      ? '<div class="conn-section-dot" style="background:' + edgeColor + '"></div>'
      : '<div class="conn-section-line" style="background:' + edgeColor + '"></div>';

    connHtml += '<div class="conn-section">';
    connHtml += '<div class="conn-section-header">' + indicator + escHtml(typeLabels[t] || t) +
      ' <span class="conn-section-count">(' + items.length + ')</span></div>';

    for (const c of items) {
      const nodeColor = TYPE_COLORS[c.node.type] || '#94A3B8';
      const weightLabel = t === 'semantic' ? (c.edge.weight * 100).toFixed(0) + '%' : '';
      const thumbUrl = nodeImage(c.node);

      connHtml += '<div class="conn-item" data-node-id="' + c.node.id + '">';

      // Thumbnail
      if (thumbUrl) {
        connHtml += '<img class="conn-thumb" src="' + thumbUrl + '" alt="" onerror="this.outerHTML=\\'<div class=conn-thumb-placeholder style=background:' + nodeColor + '>' + escHtml(c.node.title.charAt(0)) + '</div>\\'">';
      } else {
        connHtml += '<div class="conn-thumb-placeholder" style="background:' + nodeColor + '">' + escHtml(c.node.title.charAt(0)) + '</div>';
      }

      connHtml += '<div class="conn-info"><div class="conn-title">' + escHtml(c.node.title) + '</div>';
      connHtml += '<div class="conn-meta">' + c.node.type + ' \\u00b7 ' + c.node.page + '</div></div>';
      connHtml += '<div class="conn-right">';
      if (weightLabel) connHtml += '<div class="conn-weight" style="background:' + edgeColor + '15;color:' + edgeColor + '">' + weightLabel + '</div>';
      connHtml += '<span class="conn-nav-icon">\\u203a</span>';
      connHtml += '</div></div>';
    }
    connHtml += '</div>';
  }

  if (!connHtml) connHtml = '<div style="padding:20px;color:var(--fg-muted);font-size:13px">No visible connections. Try adjusting filters or threshold.</div>';

  detailConns.innerHTML = connHtml;

  // Footer metadata
  detailFooter.innerHTML = 'ID: ' + escHtml(d.id) + '<br>Page: ' + escHtml(d.page) + ' \\u00b7 Type: ' + escHtml(d.type);

  detailPanel.classList.add('open');

  // Wire connection clicks
  detailConns.querySelectorAll('.conn-item').forEach(el => {
    el.addEventListener('click', () => {
      const nid = el.dataset.nodeId;
      const node = nodes.find(n => n.id === nid);
      if (node) selectNode(node);
    });
  });
}

function renderTrail() {
  if (navHistory.length <= 1) { navTrail.innerHTML = ''; return; }
  let html = '';
  navHistory.forEach((n, i) => {
    if (i > 0) html += '<span class="trail-sep">\\u203a</span>';
    const isCurrent = i === navHistory.length - 1;
    const label = n.title.length > 16 ? n.title.slice(0, 14) + '\\u2026' : n.title;
    html += '<button class="trail-crumb' + (isCurrent ? ' current' : '') + '" data-trail-idx="' + i + '" title="' + escHtml(n.title) + '">' + escHtml(label) + '</button>';
  });
  navTrail.innerHTML = html;

  navTrail.querySelectorAll('.trail-crumb:not(.current)').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.trailIdx);
      const node = navHistory[idx];
      navHistory = navHistory.slice(0, idx);
      selectNode(node);
    });
  });
}

/* --- Type filter pills --- */
const typeFilters = document.getElementById('type-filters');
const types = [...new Set(GRAPH_DATA.nodes.map(n => n.type))];
types.forEach(t => {
  const pill = document.createElement('button');
  pill.className = 'pill active';
  pill.textContent = t;
  pill.style.background = TYPE_COLORS[t];
  pill.style.color = '#fff';
  pill.style.borderColor = TYPE_COLORS[t];
  pill.addEventListener('click', () => {
    pill.classList.toggle('active');
    if (pill.classList.contains('active')) {
      activeTypes.add(t);
      pill.style.background = TYPE_COLORS[t];
      pill.style.color = '#fff';
      pill.style.borderColor = TYPE_COLORS[t];
    } else {
      activeTypes.delete(t);
      pill.style.background = '';
      pill.style.color = '';
      pill.style.borderColor = '';
    }
    updateVisibility();
    if (selectedNode) showDetail(selectedNode);
  });
  typeFilters.appendChild(pill);
});

/* --- Edge toggles --- */
document.querySelectorAll('.edge-toggle input').forEach(cb => {
  cb.addEventListener('change', () => {
    const edgeType = cb.dataset.edge;
    if (cb.checked) activeEdgeTypes.add(edgeType);
    else activeEdgeTypes.delete(edgeType);
    updateVisibility();
    if (selectedNode) {
      applyHighlight(selectedNode.id);
      showDetail(selectedNode);
    }
  });
});

/* --- Similarity threshold slider --- */
const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
thresholdSlider.addEventListener('input', () => {
  simThreshold = parseFloat(thresholdSlider.value);
  thresholdVal.textContent = simThreshold.toFixed(2);
  updateVisibility();
  if (selectedNode) {
    applyHighlight(selectedNode.id);
    showDetail(selectedNode);
  }
});

/* --- Search --- */
let searchTimer;
document.getElementById('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    updateVisibility();

    // Pulsing search rings
    if (searchQuery) {
      searchRings
        .attr('opacity', d => isNodeVisible(d) ? 0.6 : 0)
        .each(function(d) {
          if (isNodeVisible(d) && !prefersReducedMotion) {
            d3.select(this)
              .attr('opacity', 0.4)
              .transition().duration(600).ease(d3.easeSinInOut)
              .attr('opacity', 0.8)
              .transition().duration(600).ease(d3.easeSinInOut)
              .attr('opacity', 0.4)
              .transition().duration(600).ease(d3.easeSinInOut)
              .attr('opacity', 0);
          }
        });
    } else {
      searchRings.attr('opacity', 0);
    }
  }, 300);
});

/* --- Stats bar update --- */
function updateStatsBar() {
  const visNodes = nodes.filter(isNodeVisible).length;
  const visEdges = countVisibleEdges();
  document.getElementById('stats-text').textContent =
    visNodes + ' nodes \\u00b7 ' + visEdges + ' edges visible | Zoom: ' + currentZoom.toFixed(1) + 'x';
  document.getElementById('edge-count').textContent = '(' + visEdges + ')';
}

/* --- Update visibility --- */
function updateVisibility() {
  if (selectedNode) {
    nodeGroups.style('display', d => isNodeVisible(d) ? null : 'none');
  } else {
    nodeGroups.style('display', d => isNodeVisible(d) ? (currentZoom > 3 ? 'none' : null) : 'none');
  }
  labelElements.style('display', d => isNodeVisible(d) ? (currentZoom > 3 && !selectedNode ? 'none' : null) : 'none');
  cardElements.style('display', d => isNodeVisible(d) ? (currentZoom > 3 && !selectedNode ? null : 'none') : 'none')
    .style('pointer-events', currentZoom > 3 && !selectedNode ? 'all' : 'none');
  linkElements.style('display', d => isEdgeVisible(d) ? null : 'none');
  updateStatsBar();
}

/* --- Entry animation + loading --- */
const loadingEl = document.getElementById('loading');

if (!prefersReducedMotion) {
  // Fade in nodes with stagger
  nodeGroups.attr('opacity', 0);
  labelElements.attr('opacity', 0);
  linkElements.attr('stroke-opacity', 0);
}

simulation.on('end', () => {
  loadingEl.classList.add('hidden');
  setTimeout(() => { loadingEl.style.display = 'none'; }, 400);

  if (!prefersReducedMotion) {
    nodeGroups.transition().duration(600).delay((d, i) => i * 8).attr('opacity', 1);
    labelElements.transition().duration(600).delay((d, i) => i * 8).attr('opacity', 1);
    linkElements.transition().duration(800).delay(200)
      .attr('stroke-opacity', d => d.type === 'semantic' ? Math.max(0.1, (d.weight - 0.4) * 1.5) : 0.4);
  } else {
    nodeGroups.attr('opacity', 1);
    labelElements.attr('opacity', 1);
  }

  zoomToFit();
  updateStatsBar();
});

</script>
</body>
</html>`;
}

/* ─── Main ─── */

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (REPORT_ONLY) {
    const graphPath = join(DATA_DIR, 'graph.json');
    if (!existsSync(graphPath)) {
      console.error('No graph data found. Run without --report first.');
      process.exit(1);
    }
    const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
    console.log('\n\ud83d\udcca Regenerating report...');
    const html = generateReport(graph);
    writeFileSync(REPORT_PATH, html);
    console.log(`  \u2713 Report: ${REPORT_PATH}`);
    return;
  }

  /* Step 1: Extract */
  console.log('\n\ud83d\udd0d Content extraction...');
  const nodes = extractAllNodes();
  const nodesPath = join(DATA_DIR, 'nodes.json');
  writeFileSync(nodesPath, JSON.stringify(nodes, null, 2));
  console.log(`  \u2713 ${nodes.length} content nodes extracted`);

  // Log by type
  const byType = {};
  for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }

  if (EXTRACT_ONLY) {
    console.log(`\n\u2705 Extract-only done \u2014 ${nodes.length} nodes in ${nodesPath}\n`);
    return;
  }

  /* Step 2: Embed */
  console.log('\n\ud83e\udde0 Generating embeddings...');
  const embeddings = await generateEmbeddings(nodes);

  /* Step 3: Compute edges */
  console.log('\n\ud83d\udd17 Computing similarity...');
  const semanticEdges = computeSemanticEdges(nodes, embeddings);
  console.log(`  \u2713 ${semanticEdges.length} semantic edges (threshold \u2265 ${SIMILARITY_THRESHOLD})`);

  const structuralEdges = computeStructuralEdges(nodes);
  console.log(`  \u2713 ${structuralEdges.length} structural edges`);

  const byEdgeType = {};
  for (const e of structuralEdges) byEdgeType[e.type] = (byEdgeType[e.type] || 0) + 1;
  for (const [type, count] of Object.entries(byEdgeType)) {
    console.log(`    ${type}: ${count}`);
  }

  /* Step 4: Assemble graph */
  const graph = assembleGraph(nodes, semanticEdges, structuralEdges);
  const graphPath = join(DATA_DIR, 'graph.json');
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  console.log(`\n\ud83d\udcc1 Graph: ${graphPath}`);

  /* Step 5: Generate report */
  console.log('\n\ud83d\udda5  Generating report...');
  const html = generateReport(graph);
  writeFileSync(REPORT_PATH, html);
  console.log(`  \u2713 Report: ${REPORT_PATH}`);

  console.log(`\n\u2705 Done \u2014 ${nodes.length} nodes, ${semanticEdges.length + structuralEdges.length} edges\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
