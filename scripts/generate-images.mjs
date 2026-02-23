#!/usr/bin/env node
/**
 * Generate images using Gemini image generation and convert to AVIF via sharp.
 * Usage: node scripts/generate-images.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

async function generateImage(prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['image', 'text'],
        responseMimeType: 'text/plain',
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData);
  if (!imgPart) {
    const textPart = parts.find(p => p.text);
    throw new Error(`No image returned. Text: ${textPart?.text?.slice(0, 200) || 'none'}`);
  }
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

const prompts = [
  {
    name: 'ace-polo-court-style',
    prompt: 'Candid photograph of a young man (early 20s, diverse) wearing a stylish fitted polo shirt in a rich navy blue color, walking confidently alongside a tennis court on a bright sunny day. Natural light, golden hour warmth. He carries a tennis racket casually. Background shows a real outdoor tennis facility with greenery. Shot from medium distance, lifestyle photography style, not posed. Vibrant colors, energetic mood.'
  },
  {
    name: 'ace-polo-street-transition',
    prompt: 'Candid lifestyle photograph of a young woman (early 20s, diverse) wearing a modern tennis polo shirt in a bold teal color, styled with chinos and clean white sneakers, walking on a sunny city sidewalk. She looks relaxed and confident, mid-stride. Urban setting with trees and cafe in the background. Natural daylight, warm tones. Shot from medium distance, street style photography. Vibrant and approachable.'
  },
  {
    name: 'ace-polo-friends-court',
    prompt: 'Candid group photograph of three diverse young friends (early 20s) on an outdoor tennis court, all wearing colorful polo shirts in different colors (coral, navy, white). They are laughing together, one holding a racket over their shoulder. Bright natural sunlight, real outdoor setting. Energetic, communal mood. Lifestyle photography, not posed. Vibrant saturated colors, young energy.'
  }
];

const outDir = path.resolve('public/images');

for (const { name, prompt } of prompts) {
  const outPath = path.join(outDir, `${name}.avif`);
  if (fs.existsSync(outPath)) {
    console.log(`skip  ${name}.avif already exists`);
    continue;
  }

  console.log(`Generating ${name}...`);
  try {
    const buf = await generateImage(prompt);
    await sharp(buf)
      .resize(800, null, { withoutEnlargement: true })
      .avif({ quality: 50 })
      .toFile(outPath);

    console.log(`OK ${name}.avif (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`Error ${name}: ${err.message}`);
  }
}

console.log('\nDone!');
