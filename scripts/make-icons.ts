/** Generates public/icon-192.png and icon-512.png from an inline SVG. */
import sharp from "sharp";
import path from "node:path";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#065f46"/>
      <stop offset="1" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <g fill="#ffffff">
    <rect x="116" y="356" width="280" height="36" rx="8"/>
    <rect x="140" y="216" width="36" height="124" rx="6"/>
    <rect x="238" y="216" width="36" height="124" rx="6"/>
    <rect x="336" y="216" width="36" height="124" rx="6"/>
    <path d="M256 96 L416 184 L96 184 Z"/>
    <circle cx="256" cy="152" r="18" fill="#065f46"/>
  </g>
  <text x="256" y="470" font-family="Arial" font-size="56" font-weight="bold"
        text-anchor="middle" fill="#ffffff">৳</text>
</svg>`;

async function main() {
  const pub = path.join(process.cwd(), "public");
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(pub, `icon-${size}.png`));
    console.log(`public/icon-${size}.png`);
  }
}

main();
