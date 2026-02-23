#!/usr/bin/env node

/**
 * PageSpeed Insights data collector for WKND Trendsetters.
 * Zero dependencies — uses Node 18+ built-in fetch().
 *
 * Usage:
 *   node scripts/pagespeed-collect.mjs            # collect data (skips cached)
 *   node scripts/pagespeed-collect.mjs --force     # re-collect all
 *   node scripts/pagespeed-collect.mjs --report    # regenerate report from cached data
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'pagespeed');
const REPORT_PATH = join(ROOT, 'reports', 'pagespeed.html');

const BASE_URL = 'https://wknd-trendsetters.pages.dev';
const PSI_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Load API key from .env (no dotenv dependency — manual parse)
function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();
const API_KEY = process.env.GOOGLE_PSI_API_KEY || '';

const PAGES = {
  static: [
    { slug: 'home', path: '/' },
    { slug: 'fashion-trends-young-adults', path: '/fashion-trends-young-adults' },
    { slug: 'fashion-trends-young-adults-casual-sport', path: '/fashion-trends-young-adults-casual-sport' },
    { slug: 'fashion-insights', path: '/fashion-insights' },
    { slug: 'fashion-trends-of-the-season', path: '/fashion-trends-of-the-season' },
    { slug: 'latest-trends-young-fashion', path: '/latest-trends-young-fashion' },
    { slug: 'faq', path: '/faq' },
    { slug: 'testimonial', path: '/testimonial' },
    { slug: 'products', path: '/products' },
    { slug: 'case-studies', path: '/case-studies' },
  ],
  blog: [
    { slug: 'blog-fashion-blog-post', path: '/blog/fashion-blog-post' },
    { slug: 'blog-fashion-trends-young-culture', path: '/blog/fashion-trends-young-culture' },
    { slug: 'blog-fashion-trends-young-style', path: '/blog/fashion-trends-young-style' },
    { slug: 'blog-latest-trends-young-casual-fashion', path: '/blog/latest-trends-young-casual-fashion' },
    { slug: 'blog-street-style-trends', path: '/blog/street-style-trends' },
    { slug: 'blog-flip-flop-summer-style', path: '/blog/flip-flop-summer-style' },
  ],
};

const ALL_PAGES = [...PAGES.static, ...PAGES.blog];

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const REPORT_ONLY = ARGS.includes('--report');

/* ─── Helpers ─── */

function slug2file(slug) { return join(DATA_DIR, `${slug}.json`); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatMs(ms) {
  if (ms == null) return '—';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + ' s';
  return Math.round(ms) + ' ms';
}

function formatCLS(val) {
  if (val == null) return '—';
  return val.toFixed(3);
}

function scoreColor(score) {
  if (score >= 90) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

function cwvRating(metric, value) {
  const thresholds = {
    fcp:  [1800, 3000],
    lcp:  [2500, 4000],
    cls:  [0.1, 0.25],
    tbt:  [200, 600],
    si:   [3400, 5800],
  };
  const t = thresholds[metric];
  if (!t || value == null) return 'unknown';
  return value <= t[0] ? 'good' : value <= t[1] ? 'needs-improvement' : 'poor';
}

/* ─── Data Collection ─── */

async function collectPage(page) {
  const file = slug2file(page.slug);
  if (!FORCE && existsSync(file)) {
    console.log(`  ✓ ${page.slug} (cached)`);
    return JSON.parse(readFileSync(file, 'utf-8'));
  }

  const url = `${BASE_URL}${page.path}`;
  // Build URL manually to support multiple category params
  let apiUrl = `${PSI_API}?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`;
  if (API_KEY) apiUrl += `&key=${API_KEY}`;

  console.log(`  ⏳ ${page.slug}...`);
  const start = Date.now();

  let response;
  try {
    response = await fetch(apiUrl);
  } catch (err) {
    console.error(`  ✗ ${page.slug}: network error — ${err.message}`);
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`  ✗ ${page.slug}: HTTP ${response.status} — ${body.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  ✓ ${page.slug} (${elapsed}s)`);

  writeFileSync(file, JSON.stringify(data, null, 2));
  return data;
}

function extractMetrics(data, page) {
  const lr = data.lighthouseResult;
  if (!lr) return null;

  const cats = lr.categories || {};
  const audits = lr.audits || {};

  const scores = {
    performance:     cats.performance ? Math.round(cats.performance.score * 100) : null,
    accessibility:   cats.accessibility ? Math.round(cats.accessibility.score * 100) : null,
    bestPractices:   cats['best-practices'] ? Math.round(cats['best-practices'].score * 100) : null,
    seo:             cats.seo ? Math.round(cats.seo.score * 100) : null,
  };

  const cwv = {
    fcp: audits['first-contentful-paint']?.numericValue ?? null,
    lcp: audits['largest-contentful-paint']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    tbt: audits['total-blocking-time']?.numericValue ?? null,
    si:  audits['speed-index']?.numericValue ?? null,
  };

  // Extract opportunities (audits with score < 1 and overallSavingsMs)
  const opportunities = [];
  for (const [id, audit] of Object.entries(audits)) {
    if (
      audit.score !== null &&
      audit.score < 1 &&
      audit.details?.type === 'opportunity' &&
      audit.details?.overallSavingsMs > 0
    ) {
      opportunities.push({
        id,
        title: audit.title,
        savingsMs: Math.round(audit.details.overallSavingsMs),
        description: audit.description?.split('[')[0]?.trim() || '',
      });
    }
  }
  opportunities.sort((a, b) => b.savingsMs - a.savingsMs);

  return {
    slug: page.slug,
    path: page.path,
    url: `${BASE_URL}${page.path}`,
    group: PAGES.static.includes(page) ? 'static' : 'blog',
    scores,
    cwv,
    opportunities,
  };
}

/* ─── Report Generation ─── */

function generateReport(summary) {
  const pages = summary.pages;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Compute averages
  const avg = { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
  let count = 0;
  for (const p of pages) {
    if (!p.scores) continue;
    count++;
    for (const k of Object.keys(avg)) avg[k] += p.scores[k] || 0;
  }
  for (const k of Object.keys(avg)) avg[k] = count ? Math.round(avg[k] / count) : 0;

  // Aggregate opportunities
  const oppMap = {};
  for (const p of pages) {
    for (const opp of p.opportunities || []) {
      if (!oppMap[opp.id]) {
        oppMap[opp.id] = { ...opp, totalSavingsMs: 0, affectedPages: [] };
      }
      oppMap[opp.id].totalSavingsMs += opp.savingsMs;
      oppMap[opp.id].affectedPages.push(p.slug);
    }
  }
  const topOpps = Object.values(oppMap).sort((a, b) => b.totalSavingsMs - a.totalSavingsMs).slice(0, 12);

  // Human-readable page name
  function displayName(p) {
    if (p.path === '/') return 'Home';
    return p.path.replace(/^\/blog\//, '').replace(/^\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // SVG ring helper — score value inherits ring color
  function ring(score, label, sub) {
    const c = score >= 90 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
    const circumference = 2 * Math.PI * 42; // ~264
    const offset = circumference - (score / 100) * circumference;
    return `
      <div class="score-block">
        <div class="score-ring">
          <svg viewBox="0 0 100 100" width="100" height="100">
            <circle class="bg" cx="50" cy="50" r="42"/>
            <circle class="fill" cx="50" cy="50" r="42" stroke="${c}"
              stroke-dasharray="${circumference.toFixed(0)}" stroke-dashoffset="${offset.toFixed(0)}"/>
          </svg>
          <div class="score-value" style="color:${c}">${score}</div>
        </div>
        <div class="score-label">${label}</div>
        <div class="score-source">${sub}</div>
      </div>`;
  }

  // Score cell helper
  function sc(val) {
    if (val == null) return '<td class="score-cell">\u2014</td>';
    const cls = val >= 90 ? 'score-high' : val >= 50 ? 'score-mid' : 'score-low';
    return `<td class="score-cell ${cls}">${val}</td>`;
  }

  // Table rows grouped
  function tableRows(group, label) {
    const groupPages = pages.filter(p => p.group === group);
    let html = `<tr><td colspan="8" class="group-header">${label}</td></tr>`;
    for (const p of groupPages) {
      const name = p.path === '/' ? 'Home (/)' : p.path;
      html += `<tr>
        <td class="page-name">${name}</td>
        ${sc(p.scores.performance)}
        ${sc(p.scores.accessibility)}
        ${sc(p.scores.bestPractices)}
        ${sc(p.scores.seo)}
        <td class="metric-cell">${formatMs(p.cwv.fcp)}</td>
        <td class="metric-cell">${formatMs(p.cwv.lcp)}</td>
        <td class="metric-cell">${formatCLS(p.cwv.cls)}</td>
      </tr>`;
    }
    return html;
  }

  // CWV bar chart helper — uses threshold-based scales for CLS
  function cwvBars(metric, label, unit, formatter) {
    const values = pages.map(p => p.cwv[metric]).filter(v => v != null);
    const allZero = values.every(v => v === 0);

    // For all-zero metrics, show a compact "all passing" note instead of 15 empty bars
    if (allZero) {
      return `<h3>${label}</h3>
      <div class="card cwv-card">
        <div class="all-pass">All ${pages.length} pages: <strong>0 ${unit}</strong> <span class="badge badge-green">Good</span></div>
      </div>`;
    }

    let html = `<h3>${label}</h3><div class="card cwv-card">`;

    // For CLS, use the "poor" threshold (0.25) as max to show meaningful bars
    // For time metrics, use the max value
    const scaleMax = metric === 'cls' ? 0.25 : Math.max(...values, 1);

    for (const p of pages) {
      const val = p.cwv[metric];
      if (val == null) continue;
      const rating = cwvRating(metric, val);
      const color = rating === 'good' ? 'green' : rating === 'needs-improvement' ? 'yellow' : 'red';
      const pct = Math.max(Math.min((val / scaleMax) * 100, 100), val > 0 ? 2 : 0);
      const name = displayName(p);
      html += `
        <div class="bar-row">
          <div class="bar-label">${name}</div>
          <div class="bar-track"><div class="bar-fill ${color}" style="width:${pct.toFixed(1)}%"></div></div>
          <div class="bar-value">${formatter(val)}</div>
        </div>`;
    }
    html += '</div>';
    return html;
  }

  // Per-page details
  function pageDetails() {
    let html = '';
    for (const p of pages) {
      const name = p.path === '/' ? 'Home (/)' : p.path;
      html += `
      <details class="page-detail">
        <summary>
          <strong>${name}</strong>
          <span class="detail-scores">
            <span class="badge badge-${scoreColor(p.scores.performance)}">Perf ${p.scores.performance}</span>
            <span class="badge badge-${scoreColor(p.scores.accessibility)}">A11y ${p.scores.accessibility}</span>
            <span class="badge badge-${scoreColor(p.scores.bestPractices)}">BP ${p.scores.bestPractices}</span>
            <span class="badge badge-${scoreColor(p.scores.seo)}">SEO ${p.scores.seo}</span>
          </span>
        </summary>
        <div class="detail-body">
          <div class="detail-grid">
            <div><strong>FCP:</strong> ${formatMs(p.cwv.fcp)}</div>
            <div><strong>LCP:</strong> ${formatMs(p.cwv.lcp)}</div>
            <div><strong>CLS:</strong> ${formatCLS(p.cwv.cls)}</div>
            <div><strong>TBT:</strong> ${formatMs(p.cwv.tbt)}</div>
            <div><strong>Speed Index:</strong> ${formatMs(p.cwv.si)}</div>
          </div>
          ${p.opportunities.length ? `
          <h4 class="opp-heading">Improvement Opportunities</h4>
          <table>
            <tr><th>Opportunity</th><th class="th-right">Est. Savings</th></tr>
            ${p.opportunities.map(o => `<tr><td>${o.title}</td><td class="td-savings">${formatMs(o.savingsMs)}</td></tr>`).join('')}
          </table>` : '<p class="no-opps">No improvement opportunities flagged.</p>'}
        </div>
      </details>`;
    }
    return html;
  }

  // Opportunity rows
  function oppRows() {
    if (!topOpps.length) return '<p class="muted">No improvement opportunities found.</p>';
    let html = '<table><tr><th>Opportunity</th><th class="th-right">Total Est. Savings</th><th class="th-center">Pages Affected</th></tr>';
    for (const o of topOpps) {
      html += `<tr>
        <td><strong>${o.title}</strong></td>
        <td class="td-savings">${formatMs(o.totalSavingsMs)}</td>
        <td class="td-center">${o.affectedPages.length} / ${pages.length}</td>
      </tr>`;
    }
    html += '</table>';
    return html;
  }

  const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PageSpeed Insights Assessment \u2014 WKND Trendsetters</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  /* \u2500\u2500\u2500 Design System: Spectrum 2 (DESIGN.md) \u2500\u2500\u2500 */
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
    --score-good:     #059669;
    --score-mid:      #D97706;
    --score-poor:     #DC2626;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font); background: var(--bg); color: var(--fg); line-height: 1.5; font-size: 14px; }

  /* \u2500\u2500\u2500 Focus \u2500\u2500\u2500 */
  :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

  /* \u2500\u2500\u2500 Header \u2500\u2500\u2500 */
  .header { background: var(--bg-2); border-bottom: 1px solid var(--border); padding: 16px 24px; }
  .header-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  h1 { font-size: 25px; font-weight: 800; line-height: 30px; color: var(--fg-heading); }
  .subtitle { color: var(--fg-muted); font-size: 14px; margin-top: 2px; }
  .back-link { font-size: 14px; color: var(--primary); text-decoration: none; font-weight: 600; transition: color 150ms ease-out; }
  .back-link:hover { color: var(--fg-heading); }

  /* \u2500\u2500\u2500 Container \u2500\u2500\u2500 */
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  h2 { font-size: 18px; font-weight: 700; color: var(--fg-heading); margin: 40px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); display: inline-block; }
  h3 { font-size: 14px; font-weight: 700; color: var(--fg-heading); margin: 20px 0 8px; }

  /* \u2500\u2500\u2500 Cards \u2500\u2500\u2500 */
  .card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow-emphasized); }

  /* \u2500\u2500\u2500 Score Rings \u2500\u2500\u2500 */
  .score-hero { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 24px 0; }
  .score-block { background: var(--bg-2); border: 1px solid var(--border); border-radius: 12px; padding: 20px; text-align: center; box-shadow: var(--shadow-emphasized); }
  .score-ring { width: 100px; height: 100px; margin: 0 auto 12px; position: relative; }
  .score-ring svg { transform: rotate(-90deg); }
  .score-ring circle { fill: none; stroke-width: 8; }
  .score-ring .bg { stroke: var(--border-subtle); }
  .score-ring .fill { stroke-linecap: round; }
  .score-value { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 800; }
  .score-label { font-size: 12px; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
  .score-source { font-size: 12px; color: var(--fg-muted); margin-top: 4px; opacity: 0.7; }

  /* \u2500\u2500\u2500 Table \u2500\u2500\u2500 */
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; padding: 8px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--fg-muted); border-bottom: 1px solid var(--border); font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); font-size: 14px; }
  tr:hover td { background: rgba(59, 99, 251, 0.02); }
  .score-cell { font-weight: 700; text-align: center; width: 56px; }
  .score-high { color: var(--score-good); }
  .score-mid { color: var(--score-mid); }
  .score-low { color: var(--score-poor); }
  .page-name { font-weight: 600; font-size: 13px; }
  .metric-cell { font-size: 13px; text-align: center; color: var(--fg-muted); }
  .group-header { background: var(--bg); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fg-muted); padding: 10px 12px; }
  .th-right { text-align: right; }
  .th-center { text-align: center; }
  .td-savings { text-align: right; font-weight: 600; }
  .td-center { text-align: center; }
  .muted { color: var(--fg-muted); }

  /* \u2500\u2500\u2500 Badges \u2500\u2500\u2500 */
  .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #ECFDF5; color: var(--score-good); }
  .badge-orange { background: #FFFBEB; color: var(--score-mid); }
  .badge-red { background: #FEF2F2; color: var(--score-poor); }

  /* \u2500\u2500\u2500 Bar Chart \u2500\u2500\u2500 */
  .cwv-card { margin-bottom: 24px; }
  .bar-row { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
  .bar-label { width: 200px; font-size: 13px; font-weight: 500; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 20px; background: var(--border-subtle); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; min-width: 0; }
  .bar-fill.green { background: var(--score-good); }
  .bar-fill.yellow { background: var(--score-mid); }
  .bar-fill.red { background: var(--score-poor); }
  .bar-value { width: 56px; font-size: 13px; font-weight: 700; text-align: right; flex-shrink: 0; }
  .all-pass { font-size: 14px; color: var(--fg); display: flex; align-items: center; gap: 8px; }

  /* \u2500\u2500\u2500 Details \u2500\u2500\u2500 */
  .page-detail { background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; box-shadow: var(--shadow-emphasized); transition: box-shadow 150ms ease-out; }
  .page-detail:hover { box-shadow: var(--shadow-elevated); }
  .page-detail summary { padding: 16px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; list-style: none; }
  .page-detail summary::-webkit-details-marker { display: none; }
  .page-detail summary::before { content: '\\25B8'; font-size: 12px; color: var(--fg-muted); transition: transform 150ms ease-out; flex-shrink: 0; }
  .page-detail[open] summary::before { transform: rotate(90deg); }
  .detail-scores { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
  .detail-body { padding: 16px 20px 20px; border-top: 1px solid var(--border-subtle); }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; font-size: 14px; }
  .opp-heading { margin-top: 16px; font-size: 13px; font-weight: 700; color: var(--fg-heading); }
  .no-opps { color: var(--fg-muted); font-size: 14px; margin-top: 12px; }

  /* \u2500\u2500\u2500 Footer \u2500\u2500\u2500 */
  .footer-note { color: var(--fg-muted); font-size: 13px; margin-top: 48px; text-align: center; border-top: 1px solid var(--border); padding-top: 16px; }

  /* \u2500\u2500\u2500 Responsive \u2500\u2500\u2500 */
  @media (max-width: 768px) {
    .score-hero { grid-template-columns: repeat(2, 1fr); }
    .container { padding: 24px 16px; }
    .bar-label { width: 120px; font-size: 12px; }
    .header-inner { flex-direction: column; align-items: flex-start; }
    .detail-scores { margin-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div>
      <h1>PageSpeed Insights Assessment</h1>
      <p class="subtitle">Google Lighthouse analysis across all ${pages.length} pages (mobile) \u2014 ${date}</p>
    </div>
    <a href="hub.html" class="back-link">\u2190 Reports Hub</a>
  </div>
</div>

<div class="container">

<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550 SITE-WIDE AVERAGES \u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
<h2>Site-Wide Averages</h2>
<div class="score-hero">
  ${ring(avg.performance, 'Performance', `${pages.length}-page avg`)}
  ${ring(avg.accessibility, 'Accessibility', `${pages.length}-page avg`)}
  ${ring(avg.bestPractices, 'Best Practices', `${pages.length}-page avg`)}
  ${ring(avg.seo, 'SEO', `${pages.length}-page avg`)}
</div>

<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550 PER-PAGE SCORES \u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
<h2>Per-Page Scores</h2>
<div class="card">
  <table>
    <tr>
      <th>Page</th>
      <th class="th-center">Perf</th>
      <th class="th-center">A11y</th>
      <th class="th-center">BP</th>
      <th class="th-center">SEO</th>
      <th class="th-center">FCP</th>
      <th class="th-center">LCP</th>
      <th class="th-center">CLS</th>
    </tr>
    ${tableRows('static', 'Static Pages')}
    ${tableRows('blog', 'Blog Posts')}
  </table>
</div>

<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550 CORE WEB VITALS \u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
<h2>Core Web Vitals Breakdown</h2>
${cwvBars('fcp', 'First Contentful Paint (FCP)', 'ms', formatMs)}
${cwvBars('lcp', 'Largest Contentful Paint (LCP)', 'ms', formatMs)}
${cwvBars('cls', 'Cumulative Layout Shift (CLS)', '', formatCLS)}
${cwvBars('tbt', 'Total Blocking Time (TBT)', 'ms', formatMs)}

<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550 TOP OPPORTUNITIES \u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
<h2>Top Improvement Opportunities</h2>
<p class="muted" style="margin-bottom:16px;">Aggregated across all pages, sorted by total estimated savings.</p>
<div class="card">
  ${oppRows()}
</div>

<!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550 PER-PAGE DETAILS \u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
<h2>Per-Page Details</h2>
${pageDetails()}

<p class="footer-note">Generated by Claude Code \u2014 WKND Trendsetters Playground \u2014 Session 013</p>

</div>
</body>
</html>`;

  return reportHtml;
}

/* ─── Main ─── */

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (!REPORT_ONLY) {
    console.log(`\n📊 PageSpeed Insights — collecting data for ${ALL_PAGES.length} pages\n`);

    for (const page of ALL_PAGES) {
      await collectPage(page);
      // Small delay between API calls to avoid rate limiting
      await sleep(1000);
    }
  }

  // Build summary from cached files
  console.log('\n📋 Building summary...');
  const summaryPages = [];

  for (const page of ALL_PAGES) {
    const file = slug2file(page.slug);
    if (!existsSync(file)) {
      console.warn(`  ⚠ Missing data for ${page.slug}`);
      continue;
    }
    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const metrics = extractMetrics(data, page);
    if (metrics) summaryPages.push(metrics);
  }

  const summary = {
    collectedAt: new Date().toISOString(),
    totalPages: ALL_PAGES.length,
    collectedPages: summaryPages.length,
    pages: summaryPages,
  };

  const summaryPath = join(DATA_DIR, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`  ✓ Summary: ${summaryPath}`);

  // Generate report
  console.log('\n🖼  Generating report...');
  const html = generateReport(summary);
  writeFileSync(REPORT_PATH, html);
  console.log(`  ✓ Report: ${REPORT_PATH}`);

  console.log(`\n✅ Done — ${summaryPages.length}/${ALL_PAGES.length} pages collected\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
