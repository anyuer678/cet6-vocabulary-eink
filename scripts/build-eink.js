/**
 * E-ink version build script
 * Usage: node scripts/build-eink.js [sync|build]
 *
 * This script safely builds the eink version without contaminating the regular version.
 * It temporarily swaps the capacitor config, syncs, copies assets, then restores.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'capacitor.config.json');
const CONFIG_EINK = path.join(ROOT, 'capacitor.config.eink.json');
const CONFIG_BACKUP = path.join(ROOT, 'capacitor.config.json.bak');
const ANDROID_ASSETS = path.join(ROOT, 'android/app/src/main/assets/public');
const EINK_ASSETS = path.join(ROOT, 'android-eink/app/src/main/assets/public');

function run(cmd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function sync() {
    // Backup regular config
    fs.copyFileSync(CONFIG, CONFIG_BACKUP);
    // Swap to eink config
    fs.copyFileSync(CONFIG_EINK, CONFIG);
    try {
        // Sync (copies www-eink to android/)
        run('npx cap sync android');
        // Copy synced assets to android-eink
        fs.cpSync(ANDROID_ASSETS, EINK_ASSETS, { recursive: true });
        console.log('Eink assets copied to android-eink/');
    } finally {
        // Always restore regular config
        fs.copyFileSync(CONFIG_BACKUP, CONFIG);
        fs.unlinkSync(CONFIG_BACKUP);
        console.log('Regular config restored.');
    }
}

function build() {
    sync();
    console.log('Building eink APK...');
    run('cd android-eink && gradlew.bat assembleDebug');
    console.log('Eink build complete: android-eink/app/build/outputs/apk/debug/app-debug.apk');
}

const action = process.argv[2] || 'build';
if (action === 'sync') sync();
else if (action === 'build') build();
else console.log('Usage: node scripts/build-eink.js [sync|build]');
