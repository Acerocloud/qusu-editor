import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const archOption = process.argv.indexOf('--arch');
const architectures = (archOption < 0 ? (process.arch === 'arm64' ? 'arm64' : 'x64') : process.argv[archOption + 1]).split(',');
const packaging = process.argv.includes('--package');
const windows = process.platform === 'win32';
if (!windows && process.platform !== 'darwin') throw new Error('Launchers are built on Windows or macOS.');
const go = process.env.QUSU_GO || 'go';
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
function goOutput(args) {
  const result = spawnSync(go, args, { cwd: path.join(root, 'launcher'), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Go metadata unavailable');
  return result.stdout.trim();
}
const webRoot = path.resolve(root, 'launcher/web');
if (!webRoot.startsWith(root + path.sep)) throw new Error('Embedded assets must stay in the project workspace.');
await rm(webRoot, { recursive: true, force: true });
await mkdir(webRoot, { recursive: true });
await cp('dist', 'launcher/web', { recursive: true });
await cp('desktop/icon.png', 'launcher/icon.png');
run(go, ['mod', 'download'], { cwd: path.join(root, 'launcher') });
if (windows) run(go, ['run', './cmd/icon', '../desktop/icon.png', 'icon.ico'], { cwd: path.join(root, 'launcher') });
for (const arch of architectures) {
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported architecture: ${arch}`);
  const output = path.join(root, 'release', windows ? `win-${arch}` : `mac-${arch}/QUSU Editor.app/Contents/MacOS`);
  await mkdir(output, { recursive: true });
  const executable = path.join(output, windows ? 'QUSU Editor.exe' : 'QUSU Editor');
  const flags = `-s -w -X main.version=${version}${windows ? ' -H=windowsgui' : ''}`;
  const env = { ...process.env, GOARCH: arch === 'x64' ? 'amd64' : 'arm64', CGO_ENABLED: windows ? '0' : '1' };
  if (!windows) {
    env.CGO_CFLAGS = `-arch ${arch === 'x64' ? 'x86_64' : 'arm64'} -mmacosx-version-min=12.0`;
    env.CGO_LDFLAGS = env.CGO_CFLAGS;
  }
  run(go, ['build', '-trimpath', '-ldflags', flags, '-o', executable, '.'], { cwd: path.join(root, 'launcher'), env });
  let notices = 'QUSU Editor native launcher — third-party notices\n\n';
  notices += 'Go runtime\n' + await readFile(path.join(goOutput(['env', 'GOROOT']), 'LICENSE'), 'utf8');
  for (const name of ['fyne.io/systray', 'golang.org/x/sys', 'github.com/godbus/dbus/v5']) {
    const module = JSON.parse(goOutput(['list', '-m', '-json', name]));
    notices += `\n\n${name} ${module.Version}\n` + await readFile(path.join(module.Dir, 'LICENSE'), 'utf8');
  }
  if (windows) {
    await cp('launcher/icon.ico', path.join(output, 'icon.ico'));
    await writeFile(path.join(output, 'THIRD_PARTY_NOTICES.txt'), notices);
    if (packaging) {
      const compiler = process.env.QUSU_MAKENSIS || 'C:\\Program Files (x86)\\NSIS\\makensis.exe';
      run(compiler, ['/INPUTCHARSET', 'UTF8', `/DVERSION=${version}`, `/DARCH=${arch}`, `/DBINARY_DIR=${output}`, `/DPROJECT_DIR=${root}`, 'desktop/installer.nsi']);
    }
  } else {
    const contents = path.dirname(output);
    const resources = path.join(contents, 'Resources');
    await mkdir(resources, { recursive: true });
    await writeFile(path.join(resources, 'THIRD_PARTY_NOTICES.txt'), notices);
    await writeFile(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.qusu.editor</string>
<key>CFBundleName</key><string>QUSU Editor</string>
<key>CFBundleExecutable</key><string>QUSU Editor</string>
<key>CFBundleVersion</key><string>${version}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>icon.icns</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>`);
    const iconset = path.join(root, 'release', `icon-${arch}.iconset`);
    await mkdir(iconset, { recursive: true });
    for (const size of [16, 32, 128, 256, 512]) {
      for (const scale of [1, 2]) {
        run('/usr/bin/sips', ['-z', String(size*scale), String(size*scale), 'desktop/icon.png', '--out', path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)]);
      }
    }
    run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'icon.icns')]);
    const app = path.dirname(contents);
    run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app]);
    if (packaging) {
      const base = path.join(root, 'release', `QUSU-Editor-${version}-mac-${arch}`);
      run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, base + '.zip']);
      const staging = path.join(root, 'release', `dmg-${arch}`);
      await mkdir(staging, { recursive: true });
      await cp(app, path.join(staging, 'QUSU Editor.app'), { recursive: true });
      run('/bin/ln', ['-s', '/Applications', path.join(staging, 'Applications')]);
      run('/usr/bin/hdiutil', ['create', '-volname', 'QUSU Editor', '-srcfolder', staging, '-ov', '-format', 'UDZO', base+'.dmg']);
    }
  }
  console.log(`Built lightweight ${arch} launcher: ${executable}`);
}
