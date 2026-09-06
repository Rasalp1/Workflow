import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = 6 + count * 16;

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);

    dirEntries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(b => b.buffer)]);
}

// Start / Primary Workflow App Icon HTML
const getStartHtml = (size) => `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    overflow: hidden;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}" fill="none">
  <defs>
    <linearGradient id="bg-grad" x1="100" y1="50" x2="924" y2="974" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="45%" stop-color="#090D16" />
      <stop offset="100%" stop-color="#1E293B" />
    </linearGradient>

    <linearGradient id="border-grad" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.65" />
      <stop offset="50%" stop-color="#60A5FA" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#818CF8" stop-opacity="0.65" />
    </linearGradient>

    <linearGradient id="icon-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="45%" stop-color="#60A5FA" />
      <stop offset="100%" stop-color="#818CF8" />
    </linearGradient>

    <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#60A5FA" stop-opacity="0.06" />
      <stop offset="100%" stop-color="transparent" stop-opacity="0" />
    </radialGradient>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#38BDF8" flood-opacity="0.35" />
    </filter>
  </defs>

  <rect x="24" y="24" width="976" height="976" rx="224" fill="url(#bg-grad)" />
  <rect x="24" y="24" width="976" height="976" rx="224" fill="url(#center-glow)" />
  <rect x="24" y="24" width="976" height="976" rx="224" stroke="url(#border-grad)" stroke-width="14" />

  <g transform="translate(202, 202) scale(25.8)" fill="none" filter="url(#glow)">
    <g fill="none" stroke="url(#icon-grad)" stroke-width="1.65">
      <path d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2Zm10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2Zm-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2Z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M17 11c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1" />
    </g>
  </g>
</svg>
</body>
</html>`;

// Stop Server Icon HTML (Crimson / Rose Theme with Stop Badge)
const getStopHtml = (size) => `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    overflow: hidden;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}" fill="none">
  <defs>
    <linearGradient id="stop-bg-grad" x1="100" y1="50" x2="924" y2="974" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1A0D14" />
      <stop offset="45%" stop-color="#12070D" />
      <stop offset="100%" stop-color="#26101B" />
    </linearGradient>

    <linearGradient id="stop-border-grad" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FB7185" stop-opacity="0.75" />
      <stop offset="50%" stop-color="#F43F5E" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#E11D48" stop-opacity="0.75" />
    </linearGradient>

    <linearGradient id="stop-icon-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FDA4AF" />
      <stop offset="45%" stop-color="#FB7185" />
      <stop offset="100%" stop-color="#E11D48" />
    </linearGradient>

    <radialGradient id="stop-center-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E11D48" stop-opacity="0.25" />
      <stop offset="60%" stop-color="#FB7185" stop-opacity="0.08" />
      <stop offset="100%" stop-color="transparent" stop-opacity="0" />
    </radialGradient>

    <filter id="stop-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="18" flood-color="#E11D48" flood-opacity="0.4" />
    </filter>
  </defs>

  <rect x="24" y="24" width="976" height="976" rx="224" fill="url(#stop-bg-grad)" />
  <rect x="24" y="24" width="976" height="976" rx="224" fill="url(#stop-center-glow)" />
  <rect x="24" y="24" width="976" height="976" rx="224" stroke="url(#stop-border-grad)" stroke-width="14" />

  <g transform="translate(202, 202) scale(25.8)" fill="none" filter="url(#stop-glow)">
    <g fill="none" stroke="url(#stop-icon-grad)" stroke-width="1.65">
      <path d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2Zm10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2Zm-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2Z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M17 11c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1" />
    </g>
  </g>

  <!-- Red Stop Badge (Lower Right) -->
  <g transform="translate(730, 730)">
    <circle cx="80" cy="80" r="84" fill="#0E070A" stroke="#FB7185" stroke-width="8" />
    <rect x="48" y="48" width="64" height="64" rx="14" fill="#E11D48" />
  </g>
</svg>
</body>
</html>`;

// Menubar Template Icon HTML
const getMenubarHtml = (size) => `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px;
    height: ${size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    overflow: hidden;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
  <path d="M0 0h24v24H0z" fill="none" />
  <g fill="none" stroke="#000000" stroke-width="1.65">
    <path d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2Zm10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2Zm-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M17 11c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1" />
  </g>
</svg>
</body>
</html>`;

async function buildIcns(page, getHtmlFunc, outIcnsPath) {
  const iconsetDir = path.join('/tmp', `temp_${Date.now()}_icon.iconset`);
  fs.mkdirSync(iconsetDir, { recursive: true });

  const specs = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  for (const s of specs) {
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(getHtmlFunc(s.size));
    const buf = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join(iconsetDir, s.name), buf);
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outIcnsPath}"`);
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

async function run() {
  console.log('Launching headless browser to render icons...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1. Generate 1024x1024 public/icon.png
  console.log('Rendering 1024x1024 public/icon.png...');
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(getStartHtml(1024));
  const icon1024Buffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync(path.join(projectRoot, 'public', 'icon.png'), icon1024Buffer);

  // 2. Generate 180x180 public/apple-touch-icon.png
  console.log('Rendering 180x180 public/apple-touch-icon.png...');
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(getStartHtml(180));
  const appleTouchBuffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync(path.join(projectRoot, 'public', 'apple-touch-icon.png'), appleTouchBuffer);

  // 3. Generate favicon.ico (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoBuffers = [];
  for (const size of icoSizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(getStartHtml(size));
    const buf = await page.screenshot({ omitBackground: true });
    icoBuffers.push({ size, buffer: buf });
  }
  const icoFileBuffer = createIco(icoBuffers);
  fs.writeFileSync(path.join(projectRoot, 'src', 'app', 'favicon.ico'), icoFileBuffer);
  fs.writeFileSync(path.join(projectRoot, 'public', 'favicon.ico'), icoFileBuffer);

  // 4. Generate menubar template icons (18x18 and 36x36 @2x)
  await page.setViewportSize({ width: 18, height: 18 });
  await page.setContent(getMenubarHtml(18));
  fs.writeFileSync(path.join(projectRoot, 'public', 'menubar-icon.png'), await page.screenshot({ omitBackground: true }));

  await page.setViewportSize({ width: 36, height: 36 });
  await page.setContent(getMenubarHtml(36));
  fs.writeFileSync(path.join(projectRoot, 'public', 'menubar-icon@2x.png'), await page.screenshot({ omitBackground: true }));

  // 5. Build .icns files and update Desktop Apps
  const homeDir = process.env.HOME || '/Users/rasmusalpsten';
  const desktopStartApp = path.join(homeDir, 'Desktop', 'Workflow Server.app');
  const desktopStopApp = path.join(homeDir, 'Desktop', 'Stop Workflow Server.app');

  const startIcnsPath = path.join('/tmp', 'workflow_start.icns');
  const stopIcnsPath = path.join('/tmp', 'workflow_stop.icns');
  const startPngPath = path.join('/tmp', 'workflow_start_1024.png');
  const stopPngPath = path.join('/tmp', 'workflow_stop_1024.png');

  fs.writeFileSync(startPngPath, icon1024Buffer);

  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(getStopHtml(1024));
  const stop1024Buffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync(stopPngPath, stop1024Buffer);

  console.log('Generating macOS .icns bundles for Desktop apps...');
  await buildIcns(page, getStartHtml, startIcnsPath);
  await buildIcns(page, getStopHtml, stopIcnsPath);

  // Update Desktop Apps
  if (fs.existsSync(desktopStartApp)) {
    console.log('Updating Workflow Server.app icon...');
    const targetIcns = path.join(desktopStartApp, 'Contents', 'Resources', 'applet.icns');
    fs.copyFileSync(startIcnsPath, targetIcns);
  }

  if (fs.existsSync(desktopStopApp)) {
    console.log('Updating Stop Workflow Server.app icon...');
    const targetIcns = path.join(desktopStopApp, 'Contents', 'Resources', 'applet.icns');
    fs.copyFileSync(stopIcnsPath, targetIcns);
  }

  // Update Finder custom icon attribute using Cocoa NSWorkspace
  console.log('Applying custom Finder icons via Cocoa...');
  const swiftScript = `
import Cocoa

func setAppIcon(pngPath: String, appPath: String) {
    guard let img = NSImage(contentsOfFile: pngPath) else {
        print("Failed to load: \\(pngPath)")
        return
    }
    let success = NSWorkspace.shared.setIcon(img, forFile: appPath, options: [])
    print("Set icon for \\(appPath): \\(success)")
}

setAppIcon(pngPath: "${startPngPath}", appPath: "${desktopStartApp}")
setAppIcon(pngPath: "${stopPngPath}", appPath: "${desktopStopApp}")
`;
  fs.writeFileSync('/tmp/set_icons.swift', swiftScript);
  execSync('swift /tmp/set_icons.swift', { stdio: 'inherit' });

  // Touch and refresh Finder
  try {
    execSync(`touch "${desktopStartApp}" "${desktopStopApp}"`);
    execSync('killall Finder 2>/dev/null || true');
  } catch {}

  await browser.close();
  console.log('All icons and Desktop launcher apps successfully updated!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
