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

  // SVG ring helper
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
          <div class="score-value">${score}</div>
        </div>
        <div class="score-label">${label}</div>
        <div class="score-source">${sub}</div>
      </div>`;
  }

  // Score cell helper
  function sc(val) {
    if (val == null) return '<td class="score-cell">—</td>';
    const cls = val >= 90 ? 'score-high' : val >= 50 ? 'score-mid' : 'score-low';
    return `<td class="score-cell ${cls}">${val}</td>`;
  }

  // Table rows grouped
  function tableRows(group, label) {
    const groupPages = pages.filter(p => p.group === group);
    let html = `<tr><td colspan="8" style="background:#f8f8f8;font-weight:700;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.04em;color:#717171;padding:0.6rem 0.75rem;">${label}</td></tr>`;
    for (const p of groupPages) {
      const name = p.path === '/' ? 'Home (/)' : p.path;
      html += `<tr>
        <td style="font-weight:600;font-size:0.8rem;">${name}</td>
        ${sc(p.scores.performance)}
        ${sc(p.scores.accessibility)}
        ${sc(p.scores.bestPractices)}
        ${sc(p.scores.seo)}
        <td style="font-size:0.8rem;text-align:center;">${formatMs(p.cwv.fcp)}</td>
        <td style="font-size:0.8rem;text-align:center;">${formatMs(p.cwv.lcp)}</td>
        <td style="font-size:0.8rem;text-align:center;">${formatCLS(p.cwv.cls)}</td>
      </tr>`;
    }
    return html;
  }

  // CWV bar chart helper
  function cwvBars(metric, label, unit, formatter) {
    let html = `<h3>${label}</h3><div class="card" style="margin-bottom:1.5rem;">`;
    const values = pages.map(p => p.cwv[metric]).filter(v => v != null);
    const maxVal = Math.max(...values, 1);

    for (const p of pages) {
      const val = p.cwv[metric];
      if (val == null) continue;
      const rating = cwvRating(metric, val);
      const color = rating === 'good' ? 'green' : rating === 'needs-improvement' ? 'yellow' : 'red';
      const pct = Math.min((val / maxVal) * 100, 100);
      const name = p.path === '/' ? 'Home' : p.path.split('/').pop();
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
          <h4 style="margin-top:1rem;font-size:0.85rem;">Improvement Opportunities</h4>
          <table style="margin-top:0.5rem;">
            <tr><th>Opportunity</th><th style="text-align:right;">Est. Savings</th></tr>
            ${p.opportunities.map(o => `<tr><td style="font-size:0.8rem;">${o.title}</td><td style="font-size:0.8rem;text-align:right;font-weight:600;">${formatMs(o.savingsMs)}</td></tr>`).join('')}
          </table>` : '<p style="color:#717171;font-size:0.85rem;margin-top:0.75rem;">No improvement opportunities flagged.</p>'}
        </div>
      </details>`;
    }
    return html;
  }

  // Opportunity rows
  function oppRows() {
    if (!topOpps.length) return '<p style="color:#717171;">No improvement opportunities found.</p>';
    let html = '<table><tr><th>Opportunity</th><th style="text-align:right;">Total Est. Savings</th><th style="text-align:center;">Pages Affected</th></tr>';
    for (const o of topOpps) {
      html += `<tr>
        <td style="font-size:0.85rem;"><strong>${o.title}</strong></td>
        <td style="font-size:0.85rem;text-align:right;font-weight:700;">${formatMs(o.totalSavingsMs)}</td>
        <td style="font-size:0.8rem;text-align:center;">${o.affectedPages.length} / ${pages.length}</td>
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
<title>PageSpeed Insights Assessment &mdash; WKND Trendsetters</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8F8F8; color: #292929; line-height: 1.6; }
  .header { background: #fff; border-bottom: 1px solid #E1E1E1; padding: 1.5rem 2rem; }
  .header-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  h1 { font-size: 2rem; font-weight: 800; color: #131313; }
  .subtitle { color: #717171; margin-top: 0.25rem; }
  .back-link { font-size: 0.85rem; color: #3B63FB; text-decoration: none; font-weight: 600; }
  .back-link:hover { text-decoration: underline; }
  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  h2 { font-size: 1.3rem; font-weight: 700; color: #131313; margin: 2.5rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #3B63FB; display: inline-block; }
  h3 { font-size: 1rem; font-weight: 700; color: #131313; margin: 1.25rem 0 0.5rem; }
  .card { background: #fff; border: 1px solid #E1E1E1; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }

  /* Scores */
  .score-hero { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin: 1.5rem 0; }
  .score-block { background: #fff; border: 1px solid #E1E1E1; border-radius: 12px; padding: 1.25rem; text-align: center; }
  .score-ring { width: 100px; height: 100px; margin: 0 auto 0.75rem; position: relative; }
  .score-ring svg { transform: rotate(-90deg); }
  .score-ring circle { fill: none; stroke-width: 8; }
  .score-ring .bg { stroke: #f0f0f0; }
  .score-ring .fill { stroke-linecap: round; }
  .score-value { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.75rem; font-weight: 800; }
  .score-label { font-size: 0.8rem; color: #717171; text-transform: uppercase; letter-spacing: 0.05em; }
  .score-source { font-size: 0.75rem; color: #aaa; margin-top: 0.25rem; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  th { text-align: left; padding: 0.5rem 0.75rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #717171; border-bottom: 1px solid #E1E1E1; }
  td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
  .score-cell { font-weight: 700; text-align: center; width: 60px; }
  .score-high { color: #059669; }
  .score-mid { color: #D97706; }
  .score-low { color: #DC2626; }

  /* Badges */
  .badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
  .badge-green { background: #ECFDF5; color: #059669; }
  .badge-orange { background: #FFFBEB; color: #D97706; }
  .badge-red { background: #FEF2F2; color: #DC2626; }

  /* Bar chart */
  .bar-row { display: flex; align-items: center; gap: 0.75rem; margin: 0.4rem 0; }
  .bar-label { width: 200px; font-size: 0.8rem; font-weight: 500; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 20px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .bar-fill.green { background: #059669; }
  .bar-fill.yellow { background: #D97706; }
  .bar-fill.red { background: #DC2626; }
  .bar-value { width: 55px; font-size: 0.8rem; font-weight: 700; text-align: right; flex-shrink: 0; }

  /* Details */
  .page-detail { background: #fff; border: 1px solid #E1E1E1; border-radius: 8px; margin-bottom: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .page-detail summary { padding: 1rem 1.25rem; cursor: pointer; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .page-detail summary::-webkit-details-marker { display: none; }
  .page-detail summary::before { content: '▸'; font-size: 0.85rem; color: #717171; transition: transform 150ms; }
  .page-detail[open] summary::before { transform: rotate(90deg); }
  .detail-scores { display: flex; gap: 6px; flex-wrap: wrap; }
  .detail-body { padding: 0 1.25rem 1.25rem; border-top: 1px solid #f0f0f0; }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; margin-top: 1rem; font-size: 0.85rem; }

  .footer-note { color: #717171; font-size: 0.8rem; margin-top: 3rem; text-align: center; border-top: 1px solid #E1E1E1; padding-top: 1rem; }

  @media (max-width: 768px) {
    .score-hero { grid-template-columns: repeat(2, 1fr); }
    .container { padding: 1.5rem 1rem; }
    .bar-label { width: 120px; }
    .header-inner { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <div>
      <h1>PageSpeed Insights Assessment</h1>
      <p class="subtitle">Google Lighthouse analysis across all ${pages.length} pages (mobile) &mdash; ${date}</p>
    </div>
    <a href="hub.html" class="back-link">&larr; Reports Hub</a>
  </div>
</div>

<div class="container">

<!-- ═══════ SITE-WIDE AVERAGES ═══════ -->
<h2>Site-Wide Averages</h2>
<div class="score-hero">
  ${ring(avg.performance, 'Performance', `${pages.length}-page avg`)}
  ${ring(avg.accessibility, 'Accessibility', `${pages.length}-page avg`)}
  ${ring(avg.bestPractices, 'Best Practices', `${pages.length}-page avg`)}
  ${ring(avg.seo, 'SEO', `${pages.length}-page avg`)}
</div>

<!-- ═══════ PER-PAGE SCORES ═══════ -->
<h2>Per-Page Scores</h2>
<div class="card">
  <table>
    <tr>
      <th>Page</th>
      <th style="text-align:center;">Perf</th>
      <th style="text-align:center;">A11y</th>
      <th style="text-align:center;">BP</th>
      <th style="text-align:center;">SEO</th>
      <th style="text-align:center;">FCP</th>
      <th style="text-align:center;">LCP</th>
      <th style="text-align:center;">CLS</th>
    </tr>
    ${tableRows('static', 'Static Pages')}
    ${tableRows('blog', 'Blog Posts')}
  </table>
</div>

<!-- ═══════ CORE WEB VITALS ═══════ -->
<h2>Core Web Vitals Breakdown</h2>
${cwvBars('fcp', 'First Contentful Paint (FCP)', 'ms', formatMs)}
${cwvBars('lcp', 'Largest Contentful Paint (LCP)', 'ms', formatMs)}
${cwvBars('cls', 'Cumulative Layout Shift (CLS)', '', formatCLS)}
${cwvBars('tbt', 'Total Blocking Time (TBT)', 'ms', formatMs)}

<!-- ═══════ TOP OPPORTUNITIES ═══════ -->
<h2>Top Improvement Opportunities</h2>
<p style="font-size:0.85rem;color:#717171;margin-bottom:1rem;">Aggregated across all pages, sorted by total estimated savings.</p>
<div class="card">
  ${oppRows()}
</div>

<!-- ═══════ PER-PAGE DETAILS ═══════ -->
<h2>Per-Page Details</h2>
${pageDetails()}

<p class="footer-note">Generated by Claude Code &mdash; WKND Trendsetters Playground &mdash; Session 013</p>

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
