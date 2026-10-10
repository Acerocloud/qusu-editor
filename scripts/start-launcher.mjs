import { spawn } from 'node:child_process';
import path from 'node:path';
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const executable = path.resolve('release', process.platform === 'win32' ? `win-${arch}/QUSU Editor.exe` : `mac-${arch}/QUSU Editor.app/Contents/MacOS/QUSU Editor`);
const child = spawn(executable, [], { stdio: 'ignore', detached: true, windowsHide: true });
child.once('error', error => { console.error(error); process.exitCode = 1; });
child.unref();
