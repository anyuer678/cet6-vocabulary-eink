package com.cet6.vocabulary.eink;

import android.app.ActivityManager;
import android.content.ComponentCallbacks2;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final long MAX_HEAP_BYTES = 400L * 1024 * 1024;
    private static final long DOUBLE_CLICK_MS = 320;
    private static final long LONG_PRESS_MS = 500;

    private ESpeakTts eSpeakTts;
    private LocalTtsPlayer localTts;
    private boolean ttsInterfaceRegistered = false;

    private final Handler keyHandler = new Handler(Looper.getMainLooper());
    private long lastKeyDownTime = 0;
    private int lastKeyCode = -1;
    private String pendingKeyName = null;
    private boolean longPressFired = false;
    private Runnable longPressRunnable = null;
    private Runnable singleClickRunnable = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewForLowMemory();
        applyEinkDisplayProfile();
        requestWebViewFocus();
        localTts = new LocalTtsPlayer(this);
        eSpeakTts = new ESpeakTts(this);
        eSpeakTts.initAsync();
        registerTtsInterfaceWhenReady();
    }

    private void requestWebViewFocus() {
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.setFocusable(true);
                wv.setFocusableInTouchMode(true);
                wv.requestFocus();
            }
        } catch (Throwable ignored) {}
    }

    private void configureWebViewForLowMemory() {
        WebView wv = getBridge().getWebView();
        if (wv == null) return;
        WebSettings s = wv.getSettings();
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setLoadsImagesAutomatically(true);
        s.setTextZoom(100);
    }

    private void applyEinkDisplayProfile() {
        try {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                wv.setBackgroundColor(0xFF000000);
            }
        } catch (Throwable ignored) {}
    }

    private void registerTtsInterfaceWhenReady() {
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv == null) {
                new Handler(Looper.getMainLooper()).postDelayed(this::registerTtsInterfaceWhenReady, 300);
                return;
            }
            if (!ttsInterfaceRegistered) {
                wv.addJavascriptInterface(new TtsJsBridge(eSpeakTts, localTts), "AndroidTts");
                ttsInterfaceRegistered = true;
            }
        } catch (Throwable ignored) {}
    }

    private void registerTtsInterface(WebView wv) {
        if (wv == null || ttsInterfaceRegistered) return;
        try {
            wv.addJavascriptInterface(new TtsJsBridge(eSpeakTts, localTts), "AndroidTts");
            ttsInterfaceRegistered = true;
        } catch (Throwable ignored) {}
    }

    public static class TtsJsBridge {
        private final ESpeakTts espeak;
        private final LocalTtsPlayer local;
        public TtsJsBridge(ESpeakTts espeak, LocalTtsPlayer local) {
            this.espeak = espeak; this.local = local;
        }

        @JavascriptInterface
        public void speak(String text) {
            try {
                if (espeak != null && espeak.isReady()) { espeak.speak(text); return; }
            } catch (Throwable ignored) {}
            try { if (local != null) local.speak(text); } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public void stop() {
            try { if (espeak != null) espeak.destroy(); } catch (Throwable ignored) {}
            try { if (local != null) local.stop(); } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public boolean isReady() { return espeak != null && espeak.isReady(); }

        @JavascriptInterface
        public String getStatus() {
            if (espeak == null) return "no_engine";
            if (espeak.isReady()) return "ready";
            if (espeak.isInitFailed()) return "failed";
            return "loading";
        }

        @JavascriptInterface
        public String getInfo() { return espeak == null ? "null" : espeak.getInfo(); }

        @JavascriptInterface
        public void speakLocal(String word) {
            try { if (local != null) local.speak(word); } catch (Throwable ignored) {}
        }

        @JavascriptInterface
        public int getPhonCount() {
            try { return local == null ? 0 : local.getPhonCount(); } catch (Throwable t) { return 0; }
        }
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) {
            freeMemory();
        }
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        freeMemory();
    }

    private void freeMemory() {
        try {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                wv.clearCache(true);
                wv.freeMemory();
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
    }

    public long getSuggestedHeapBytes() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return MAX_HEAP_BYTES;
        int classMb = am.getMemoryClass();
        int largeClassMb = am.getLargeMemoryClass();
        long cap = Math.min(classMb, largeClassMb);
        return Math.min(cap * 1024L * 1024L, MAX_HEAP_BYTES);
    }

    private String mapKeyCode(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_PAGE_UP:
                return "PREV";
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_PAGE_DOWN:
                return "NEXT";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                return "CONFIRM";
            case KeyEvent.KEYCODE_BACK:
                return "BACK";
            default:
                return null;
        }
    }

    private void sendKeyToJS(String key) {
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.evaluateJavascript(
                    "window.__handleEinkKey && window.__handleEinkKey('" + key + "');", null);
            }
        } catch (Throwable ignored) {}
    }

    private void cancelKeyTimers() {
        if (longPressRunnable != null) {
            keyHandler.removeCallbacks(longPressRunnable);
            longPressRunnable = null;
        }
        if (singleClickRunnable != null) {
            keyHandler.removeCallbacks(singleClickRunnable);
            singleClickRunnable = null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        String keyName = mapKeyCode(code);
        if (keyName == null) return super.dispatchKeyEvent(event);

        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            long now = SystemClock.uptimeMillis();

            // Double-click detection
            if (lastKeyCode == code && (now - lastKeyDownTime) < DOUBLE_CLICK_MS) {
                cancelKeyTimers();
                lastKeyCode = -1;
                lastKeyDownTime = 0;
                longPressFired = false;
                pendingKeyName = null;
                sendKeyToJS("DBL_CLICK");
                return true;
            }

            lastKeyCode = code;
            lastKeyDownTime = now;
            longPressFired = false;
            pendingKeyName = keyName;

            final String kn = keyName;
            if (longPressRunnable != null) keyHandler.removeCallbacks(longPressRunnable);
            longPressRunnable = () -> {
                longPressFired = true;
                if (singleClickRunnable != null) keyHandler.removeCallbacks(singleClickRunnable);
                singleClickRunnable = null;
                sendKeyToJS("LONG_" + kn);
            };
            keyHandler.postDelayed(longPressRunnable, LONG_PRESS_MS);

            return true;
        }

        if (event.getAction() == KeyEvent.ACTION_UP) {
            if (longPressRunnable != null) {
                keyHandler.removeCallbacks(longPressRunnable);
                longPressRunnable = null;
            }

            if (longPressFired) {
                longPressFired = false;
                pendingKeyName = null;
                return true;
            }

            final String kn = pendingKeyName;
            pendingKeyName = null;
            if (kn == null) return true;

            if (singleClickRunnable != null) keyHandler.removeCallbacks(singleClickRunnable);
            singleClickRunnable = () -> {
                singleClickRunnable = null;
                sendKeyToJS(kn);
            };
            keyHandler.postDelayed(singleClickRunnable, DOUBLE_CLICK_MS);

            return true;
        }

        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onDestroy() {
        cancelKeyTimers();
        try { if (eSpeakTts != null) eSpeakTts.destroy(); } catch (Throwable ignored) {}
        try { if (localTts != null) localTts.destroy(); } catch (Throwable ignored) {}
        super.onDestroy();
    }
}
