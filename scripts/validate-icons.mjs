#!/usr/bin/env node

/**
 * Iconography validator for WKND Trendsetters.
 * Scans .astro files for icon consistency issues. No dependencies required.
 * Exit code 1 on failures, 0 on pass.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');

const issues = [];

// Known exceptions that don't follow the 24x24 viewBox rule
const VIEWBOX_EXCEPTIONS = [
  '0 0 33 33',  // Brand star logo
  '0 0 16 16',  // Social media icons (platform brand assets)
  '0 0 32 32',  // Mega menu category icons (migration planned — see brand/iconography.md)
];

function walk(dir, ext) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full, ext));
    } else if (full.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

function addIssue(file, line, rule, message) {
  issues.push({
    file: relative(process.cwd(), file),
    line,
    rule,
    message,
  });
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inFrontmatter = false;
  let frontmatterCount = 0;
  let inScript = false;
  let inStyle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '---') {
      frontmatterCount++;
      inFrontmatter = frontmatterCount % 2 === 1;
      continue;
    }
    if (inFrontmatter) continue;
    if (trimmed.startsWith('<script')) inScript = true;
    if (trimmed.startsWith('</script')) inScript = false;
    if (trimmed.startsWith('<style')) inStyle = true;
    if (trimmed.startsWith('</style')) inStyle = false;
    if (inScript || inStyle) continue;

    const svgMatches = line.matchAll(/<svg\b[^>]*>/gi);
    for (const match of svgMatches) {
      const tag = match[0];

      // Rule: Check viewBox
      const viewBoxMatch = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      if (viewBoxMatch) {
        const viewBox = viewBoxMatch[1];
        if (viewBox !== '0 0 24 24' && !VIEWBOX_EXCEPTIONS.includes(viewBox)) {
          addIssue(filePath, i + 1, 'viewbox', `SVG viewBox "${viewBox}" is not 24x24 (and not an exception)`);
        }
      }

      // Rule: Check for hard-coded colors (not currentColor)
      const fillMatch = tag.match(/\bfill\s*=\s*["']([^"']+)["']/i);
      if (fillMatch) {
        const fill = fillMatch[1];
        if (fill !== 'currentColor' && fill !== 'none') {
          addIssue(filePath, i + 1, 'hardcoded-color', `SVG uses hard-coded fill="${fill}" instead of currentColor`);
        }
      }

      const strokeMatch = tag.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
      if (strokeMatch) {
        const stroke = strokeMatch[1];
        if (stroke !== 'currentColor' && stroke !== 'none') {
          addIssue(filePath, i + 1, 'hardcoded-color', `SVG uses hard-coded stroke="${stroke}" instead of currentColor`);
        }
      }

      // Rule: Check for missing aria-hidden on decorative icons
      if (!/aria-hidden/i.test(tag) && !/role\s*=\s*["']img["']/i.test(tag)) {
        addIssue(filePath, i + 1, 'aria-hidden', `SVG missing aria-hidden="true"`);
      }
    }

    // Check child elements for hard-coded stroke on nested elements (like <line>, <path>, <g>)
    const nestedStroke = line.matchAll(/\bstroke\s*=\s*["']([^"']+)["']/gi);
    for (const sm of nestedStroke) {
      const val = sm[1];
      if (val !== 'currentColor' && val !== 'none' && !line.includes('<svg')) {
        // Only flag if it's not inside an <svg> tag itself (those are caught above)
        // and it's an actual color value (not a stroke-width etc)
        if (/^#[0-9a-fA-F]+$/.test(val) || /^rgb/i.test(val)) {
          addIssue(filePath, i + 1, 'hardcoded-color', `Nested element uses hard-coded stroke="${val}"`);
        }
      }
    }
  }
}

// Run
const astroFiles = walk(SRC_DIR, '.astro');
for (const file of astroFiles) {
  checkFile(file);
}

// Output
const result = {
  total: issues.length,
  pass: issues.length === 0,
  issues,
};

console.log(JSON.stringify(result, null, 2));

if (!result.pass) {
  console.error(`\n❌ ${issues.length} icon issue(s) found.`);
  process.exit(1);
} else {
  console.log('\n✅ All icon checks passed.');
}
