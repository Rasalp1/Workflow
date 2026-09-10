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

async function buildAssetsAndIcns(page, getHtmlFunc, outBaseName) {
  const xcassetsDir = path.join('/tmp', `${outBaseName}.xcassets`);
  fs.mkdirSync(xcassetsDir, { recursive: true });

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

  const contentsJson = {
    images: [
      { idiom: 'mac', size: '16x16', scale: '1x', filename: 'icon_16x16.png' },
      { idiom: 'mac', size: '16x16', scale: '2x', filename: 'icon_16x16@2x.png' },
      { idiom: 'mac', size: '32x32', scale: '1x', filename: 'icon_32x32.png' },
      { idiom: 'mac', size: '32x32', scale: '2x', filename: 'icon_32x32@2x.png' },
      { idiom: 'mac', size: '128x128', scale: '1x', filename: 'icon_128x128.png' },
      { idiom: 'mac', size: '128x128', scale: '2x', filename: 'icon_128x128@2x.png' },
      { idiom: 'mac', size: '256x256', scale: '1x', filename: 'icon_256x256.png' },
      { idiom: 'mac', size: '256x256', scale: '2x', filename: 'icon_256x256@2x.png' },
      { idiom: 'mac', size: '512x512', scale: '1x', filename: 'icon_512x512.png' },
      { idiom: 'mac', size: '512x512', scale: '2x', filename: 'icon_512x512@2x.png' },
    ],
    info: { author: 'xcode', version: 1 },
  };

  const iconsetDir = path.join('/tmp', `${outBaseName}.iconset`);
  fs.mkdirSync(iconsetDir, { recursive: true });

  const appIconDir = path.join(xcassetsDir, 'AppIcon.appiconset');
  const appletIconDir = path.join(xcassetsDir, 'applet.appiconset');
  fs.mkdirSync(appIconDir, { recursive: true });
  fs.mkdirSync(appletIconDir, { recursive: true });
  fs.writeFileSync(path.join(appIconDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2));
  fs.writeFileSync(path.join(appletIconDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2));

  for (const s of specs) {
    await page.setViewportSize({ width: s.size, height: s.size });
    await page.setContent(getHtmlFunc(s.size));
    const buf = await page.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join(iconsetDir, s.name), buf);
    fs.writeFileSync(path.join(appIconDir, s.name), buf);
    fs.writeFileSync(path.join(appletIconDir, s.name), buf);
  }

  // 1. Build .icns using iconutil
  const outIcnsPath = path.join('/tmp', `${outBaseName}.icns`);
  execSync(`iconutil -c icns "${iconsetDir}" -o "${outIcnsPath}"`);
  fs.rmSync(iconsetDir, { recursive: true, force: true });

  // 2. Build Assets.car using actool
  const actoolOutDir = path.join('/tmp', `${outBaseName}_actool_out`);
  fs.mkdirSync(actoolOutDir, { recursive: true });
  execSync(
    `xcrun actool "${xcassetsDir}" --compile "${actoolOutDir}" --platform macosx --minimum-deployment-target 11.0 --app-icon AppIcon --app-icon applet --output-partial-info-plist "/tmp/${outBaseName}_partial.plist"`
  );
  const outCarPath = path.join(actoolOutDir, 'Assets.car');
  fs.rmSync(xcassetsDir, { recursive: true, force: true });

  return { icnsPath: outIcnsPath, carPath: outCarPath };
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

  // 5. Build native macOS icon bundles. The transparent ICNS is canonical;
  // make_transparent_icon.swift removes Assets.car so macOS cannot substitute a
  // catalog-rendered squircle for the source artwork.
  console.log('Compiling native macOS icon bundles via actool & iconutil...');
  const startAssets = await buildAssetsAndIcns(page, getStartHtml, 'workflow_start');
  const stopAssets = await buildAssetsAndIcns(page, getStopHtml, 'workflow_stop');

  const homeDir = process.env.HOME || '/Users/rasmusalpsten';
  const isAppBundle = (p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'Contents'));
    } catch {
      return false;
    }
  };

  const startAppCandidates = [
    path.join(homeDir, 'Desktop', 'Workflow.app'),
    path.join(homeDir, 'Desktop', 'Workflow Server.app'),
    path.join(homeDir, 'Applications', 'Workflow.app'),
    '/Applications/Workflow.app',
  ].filter(isAppBundle);

  const stopAppCandidates = [
    path.join(homeDir, 'Desktop', 'Stop Workflow Server.app'),
    path.join(homeDir, 'Desktop', 'Stop Workflow.app'),
    path.join(homeDir, 'Applications', 'Stop Workflow Server.app'),
    '/Applications/Stop Workflow Server.app',
  ].filter(isAppBundle);

  function updateAppBundle(appPath, assets, bundleId, appName) {
    console.log(`Updating app bundle at ${appPath}...`);
    // Remove any stale Icon\r or resource fork detritus
    const iconFile = path.join(appPath, 'Icon\r');
    if (fs.existsSync(iconFile)) {
      try {
        fs.unlinkSync(iconFile);
      } catch {}
    }
    try {
      execSync(`xattr -cr "${appPath}"`);
    } catch {}

    const resourcesDir = path.join(appPath, 'Contents', 'Resources');
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.copyFileSync(assets.icnsPath, path.join(resourcesDir, 'applet.icns'));
    fs.copyFileSync(assets.carPath, path.join(resourcesDir, 'Assets.car'));

    // Patch Info.plist
    const plistPath = path.join(appPath, 'Contents', 'Info.plist');
    if (fs.existsSync(plistPath)) {
      let content = fs.readFileSync(plistPath, 'utf8');
      if (bundleId && !content.includes('CFBundleIdentifier')) {
        content = content.replace(
          '<key>CFBundleInfoDictionaryVersion</key>',
          `<key>CFBundleIdentifier</key>\n\t<string>${bundleId}</string>\n\t<key>CFBundleInfoDictionaryVersion</key>`
        );
      }
      if (!content.includes('CFBundleIconName')) {
        content = content.replace(
          '<key>CFBundleIconFile</key>\n\t<string>applet</string>',
          '<key>CFBundleIconFile</key>\n\t<string>applet</string>\n\t<key>CFBundleIconName</key>\n\t<string>applet</string>'
        );
      }
      fs.writeFileSync(plistPath, content, 'utf8');
    }

    // Ad-hoc sign so LaunchServices and macOS gatekeeper consider the bundle valid
    try {
      execSync(`codesign --force --deep --sign - "${appPath}"`);
      console.log(`Code signed ${appPath}: valid`);
    } catch (e) {
      console.warn(`Codesign error for ${appPath}:`, e.message);
    }
  }

  for (const p of startAppCandidates) {
    updateAppBundle(p, startAssets, 'com.workflow.app', 'Workflow');
  }

  for (const p of stopAppCandidates) {
    updateAppBundle(p, stopAssets, 'com.workflow.stop-server', 'Stop Workflow Server');
  }

  // Finish with the same transparent-ICNS setup used by Manageur and Skiller:
  // CFBundleIconFile=AppIcon plus Finder's kHasCustomIcon flag sourced from ICNS.
  execSync('/usr/bin/swift scripts/make_transparent_icon.swift', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Update Dock plist to ensure tile-type and bundle-identifier match
  console.log('Ensuring Dock tile-data is configured as application tile...');
  try {
    const dockXml = execSync('defaults export com.apple.dock -', { encoding: 'utf8' });
    if (dockXml.includes('Workflow.app')) {
      const pyScript = `
import plistlib, sys
dock = plistlib.loads(sys.stdin.buffer.read())
changed = False
for item in dock.get('persistent-apps', []):
    tile = item.get('tile-data', {})
    url = tile.get('file-data', {}).get('_CFURLString', '')
    if 'Workflow.app' in url:
        tile['bundle-identifier'] = 'com.workflow.app'
        tile['file-type'] = 1
        changed = True
if changed:
    sys.stdout.buffer.write(plistlib.dumps(dock, fmt=plistlib.FMT_XML))
else:
    sys.stdout.buffer.write(sys.stdin.buffer.read())
`;
      const modifiedDockXml = execSync(`python3 -c "${pyScript}"`, { input: dockXml, encoding: 'utf8' });
      execSync('defaults import com.apple.dock -', { input: modifiedDockXml });
    }
  } catch (err) {
    console.warn('Dock plist update warning:', err.message);
  }

  // Clear system icon caches and register with LaunchServices
  console.log('Flushing macOS icon caches and resetting Dock...');
  try {
    execSync('rm -f /var/folders/*/*/*/com.apple.dock.iconcache 2>/dev/null || true');
    execSync('rm -rf /var/folders/*/*/*/com.apple.iconservices* 2>/dev/null || true');
    execSync('qlmanage -r cache 2>/dev/null || true');
  } catch {}

  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
  for (const target of [...startAppCandidates, ...stopAppCandidates]) {
    try {
      execSync(`touch "${target}"`);
      if (fs.existsSync(lsregister)) {
        execSync(`"${lsregister}" -f "${target}"`);
      }
    } catch {}
  }

  try {
    execSync('killall Finder 2>/dev/null || true');
    execSync('killall Dock 2>/dev/null || true');
  } catch {}

  await browser.close();
  console.log('All icons and Desktop launcher apps successfully updated!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
