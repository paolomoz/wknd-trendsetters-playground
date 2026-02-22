#!/usr/bin/env node

/**
 * Accessibility validator for WKND Trendsetters.
 * Scans .astro files for common a11y issues. No dependencies required.
 * Exit code 1 on failures, 0 on pass.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');
const STYLES_DIR = join(process.cwd(), 'src', 'styles');

const issues = [];

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
  const rel = relative(process.cwd(), filePath);

  // Skip frontmatter (between --- markers)
  let inFrontmatter = false;
  let frontmatterCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '---') {
      frontmatterCount++;
      inFrontmatter = frontmatterCount % 2 === 1;
      continue;
    }
    if (inFrontmatter) continue;

    // Rule: <img> without alt attribute
    const imgMatches = line.matchAll(/<img\b[^>]*>/gi);
    for (const match of imgMatches) {
      const tag = match[0];
      if (!/\balt\s*=/i.test(tag)) {
        addIssue(filePath, i + 1, 'img-alt', `<img> missing alt attribute`);
      }
    }

    // Rule: <svg> without aria-hidden (in template, not script/style)
    const svgMatches = line.matchAll(/<svg\b[^>]*>/gi);
    for (const match of svgMatches) {
      const tag = match[0];
      if (!/aria-hidden/i.test(tag) && !/role\s*=\s*["']img["']/i.test(tag)) {
        addIssue(filePath, i + 1, 'svg-aria-hidden', `<svg> missing aria-hidden="true" (decorative) or role="img" (meaningful)`);
      }
    }

    // Rule: <button> or <a> without accessible name
    const buttonMatches = line.matchAll(/<button\b[^>]*>(\s*)<\/button>/gi);
    for (const match of buttonMatches) {
      const tag = match[0];
      if (!/aria-label/i.test(tag)) {
        addIssue(filePath, i + 1, 'button-name', `Empty <button> without aria-label`);
      }
    }

    // Rule: <nav> without aria-label
    const navMatches = line.matchAll(/<nav\b[^>]*>/gi);
    for (const match of navMatches) {
      const tag = match[0];
      if (!/aria-label/i.test(tag)) {
        addIssue(filePath, i + 1, 'nav-label', `<nav> missing aria-label`);
      }
    }
  }

  // Rule: Check heading hierarchy (h1-h6 usage)
  const headingLevels = [];
  let inScript = false;
  let inStyle = false;
  frontmatterCount = 0;
  inFrontmatter = false;

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

    const headingMatch = line.match(/<h([1-6])\b/i);
    if (headingMatch) {
      headingLevels.push({ level: parseInt(headingMatch[1]), line: i + 1 });
    }
  }

  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1].level;
    const curr = headingLevels[i].level;
    if (curr > prev + 1) {
      addIssue(filePath, headingLevels[i].line, 'heading-hierarchy', `Heading h${curr} skips level (previous was h${prev})`);
    }
  }
}

function checkCSS() {
  const cssFiles = walk(STYLES_DIR, '.css');
  let hasFocusVisible = false;
  let hasReducedMotion = false;

  for (const file of cssFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes(':focus-visible')) hasFocusVisible = true;
    if (content.includes('prefers-reduced-motion')) hasReducedMotion = true;
  }

  if (!hasFocusVisible) {
    addIssue(join(STYLES_DIR, 'global.css'), 0, 'focus-visible', 'No :focus-visible rule found in CSS');
  }
  if (!hasReducedMotion) {
    addIssue(join(STYLES_DIR, 'global.css'), 0, 'reduced-motion', 'No prefers-reduced-motion media query found in CSS');
  }
}

// Run
const astroFiles = walk(SRC_DIR, '.astro');
for (const file of astroFiles) {
  checkFile(file);
}
checkCSS();

// Output
const result = {
  total: issues.length,
  pass: issues.length === 0,
  issues,
};

console.log(JSON.stringify(result, null, 2));

if (!result.pass) {
  console.error(`\n❌ ${issues.length} accessibility issue(s) found.`);
  process.exit(1);
} else {
  console.log('\n✅ All accessibility checks passed.');
}
