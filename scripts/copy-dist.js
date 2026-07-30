/**
 * Copy built APKs to dist/ directory
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const files = [
    { src: 'android/app/build/outputs/apk/debug/app-debug.apk', dst: 'cet6-regular-v1.0.apk' },
    { src: 'android-eink/app/build/outputs/apk/debug/app-debug.apk', dst: 'cet6-eink-v1.0.apk' },
    { src: 'electron/dist/CET-6词汇学习.exe', dst: 'cet6-desktop-v1.0.exe' },
];

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

for (const f of files) {
    const src = path.join(ROOT, f.src);
    const dst = path.join(DIST, f.dst);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        const size = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
        console.log(`${f.dst} (${size} MB)`);
    } else {
        console.log(`SKIP: ${f.src} not found`);
    }
}
