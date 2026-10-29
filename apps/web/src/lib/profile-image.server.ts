import { Resvg } from '@resvg/resvg-js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fontBase64 from '../assets/geist-social.ttf.b64?raw';
import type { Profile } from '../components/profile-page';

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  );
}
function lines(text: string, width: number) {
  const result: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = result.at(-1);
    if (last && last.length + word.length < width) result[result.length - 1] += ` ${word}`;
    else result.push(word.slice(0, width));
  }
  return result.slice(0, 2).map(escape);
}
let fontPath: string | undefined;
function previewFont() {
  if (fontPath) return fontPath;
  const directory = mkdtempSync(join(tmpdir(), 'credora-preview-font-'));
  fontPath = join(directory, 'geist.ttf');
  writeFileSync(fontPath, Buffer.from(fontBase64.trim(), 'base64'));
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }));
  return fontPath;
}
export function renderProfileImage(profile: Profile) {
  const name = lines(profile.name, 30);
  const headline = lines(profile.headline || 'Professional identity. Evidence you can check.', 55);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#faf9fc"/>
    <rect x="48" y="48" width="1104" height="534" rx="24" fill="#fff" stroke="#e6e2ec"/>
    <rect x="90" y="90" width="64" height="64" rx="18" fill="#6843ca"/>
    <text x="122" y="135" text-anchor="middle" fill="white" font-family="Geist" font-size="42" font-weight="700">C</text>
    <text x="172" y="134" fill="#1d1a22" font-family="Geist" font-size="36" font-weight="600">credora</text>
    ${name.map((line, index) => `<text x="90" y="${246 + index * 65}" fill="#1d1a22" font-family="Geist" font-size="60" font-weight="600">${line}</text>`).join('')}
    <text x="90" y="${name.length > 1 ? 365 : 305}" fill="#6843ca" font-family="Geist" font-size="30">@${escape(profile.handle)}</text>
    ${headline.map((line, index) => `<text x="90" y="${425 + index * 40}" fill="#686572" font-family="Geist" font-size="30">${line}</text>`).join('')}
    <text x="90" y="540" fill="#686572" font-family="Geist" font-size="22">Explore the work. Check the evidence.</text>
  </svg>`;
  return new Resvg(svg, {
    font: { fontFiles: [previewFont()], loadSystemFonts: false, defaultFontFamily: 'Geist' },
  })
    .render()
    .asPng();
}
