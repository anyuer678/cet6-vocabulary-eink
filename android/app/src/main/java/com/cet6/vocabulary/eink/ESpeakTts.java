package com.cet6.vocabulary.eink;

import android.content.Context;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ESpeakTts {
    private static final String TAG = "ESpeakTts";
    private static final String DATA_SUBDIR = "espeak";
    private static final int SAMPLE_RATE = 22050;

    private static volatile boolean sNativeLibLoaded = false;
    private static volatile String sNativeLibError = null;

    static {
        try {
            System.loadLibrary("espeak-ng");
            try {
                System.loadLibrary("espeak_jni");
                sNativeLibLoaded = true;
            } catch (Throwable t) {
                sNativeLibError = "libespeak_jni: " + t.getMessage();
                Log.e(TAG, "loadLibrary libespeak_jni failed", t);
            }
        } catch (Throwable t) {
            sNativeLibError = "libespeak-ng: " + t.getMessage();
            Log.e(TAG, "loadLibrary libespeak-ng failed", t);
        }
    }

    private static native int nativeInit(String dataPath);
    private static native void nativeSetVoice(String voice);
    private static native int nativeSetRate(int rate);
    private static native String nativeInfo();
    private static native void nativeTerminate();
    private static native int nativeSynth(byte[] textBytes, short[] outBuf, int maxSamples);
    private static native int nativeGetSampleRate();

    private final Context appContext;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final AudioManager audioManager;
    private volatile boolean ready = false;
    private volatile boolean initStarted = false;
    private volatile boolean initFailed = false;
    private volatile String initError = null;
    private AudioFocusRequest focusRequest;
    private AudioManager.OnAudioFocusChangeListener focusListener;

    public ESpeakTts(Context context) {
        this.appContext = context.getApplicationContext();
        this.audioManager = (AudioManager) appContext.getSystemService(Context.AUDIO_SERVICE);
    }

    public void initAsync() {
        if (initStarted) return;
        initStarted = true;
        if (!sNativeLibLoaded) {
            initFailed = true;
            initError = "native lib not loaded: " + sNativeLibError;
            Log.e(TAG, "ABORT init: " + initError);
            return;
        }
        exec.execute(() -> {
            try {
                File dataDir = ensureDataDir();
                if (dataDir == null) {
                    initFailed = true; initError = "ensureDataDir failed";
                    Log.e(TAG, "init failed: " + initError); return;
                }
                int rc = nativeInit(dataDir.getAbsolutePath());
                if (rc == 0) {
                    try { nativeSetVoice("en-us"); } catch (Throwable ignored) {}
                    try { nativeSetRate(165); } catch (Throwable ignored) {}
                    ready = true;
                    Log.i(TAG, "READY: " + nativeInfo());
                } else {
                    initFailed = true; initError = "nativeInit rc=" + rc;
                    Log.e(TAG, "init failed: " + initError);
                }
            } catch (Throwable t) {
                initFailed = true; initError = "init threw: " + t;
                Log.e(TAG, "init failed", t);
            }
        });
    }

    public boolean isReady() { return ready; }
    public boolean isInitFailed() { return initFailed; }
    public String getInitError() { return initError; }

    public String getInfo() {
        try {
            int sr = nativeGetSampleRate();
            return "espeak sr=" + sr + (ready ? " ready" : (initFailed ? " failed" : " loading"));
        } catch (Throwable t) { return "espeak not loaded"; }
    }

    private boolean requestFocus() {
        if (audioManager == null) return true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (focusListener == null) {
                    focusListener = change -> {};
                }
                if (focusRequest == null) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
                    focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(attrs)
                        .setOnAudioFocusChangeListener(focusListener).build();
                }
                return audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            } else {
                return audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            }
        } catch (Throwable t) { return true; }
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
            else audioManager.abandonAudioFocus(null);
        } catch (Throwable ignored) {}
    }

    public void speak(final String text) {
        if (text == null || text.isEmpty()) return;
        if (!ready) { Log.w(TAG, "speak before ready"); return; }
        exec.execute(() -> {
            try { synthAndPlay(text); } catch (Throwable t) { Log.e(TAG, "synthAndPlay threw", t); }
        });
    }

    private void synthAndPlay(String text) {
        byte[] txt = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        int maxSamples = Math.max(SAMPLE_RATE * 3, txt.length * 600);
        short[] buf = new short[maxSamples];
        int n = nativeSynth(txt, buf, maxSamples);
        if (n <= 0) { Log.w(TAG, "synth 0 samples: '" + text + "'"); return; }
        playPcm(buf, n);
    }

    private void playPcm(short[] pcm, int samples) {
        requestFocus();
        int nonZero = 0;
        for (int i = 0; i < samples; i++) { if (pcm[i] != 0) nonZero++; }
        if (nonZero == 0) { Log.w(TAG, "PCM all zeros"); return; }

        AudioTrack track = null;
        try {
            int bufSize = AudioTrack.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (bufSize < samples * 2) bufSize = samples * 2;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
                AudioFormat fmt = new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
                track = new AudioTrack.Builder()
                    .setAudioAttributes(attrs).setAudioFormat(fmt)
                    .setBufferSizeInBytes(bufSize)
                    .setTransferMode(AudioTrack.MODE_STREAM).build();
            } else {
                track = new AudioTrack(AudioManager.STREAM_MUSIC, SAMPLE_RATE,
                    AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT,
                    bufSize, AudioTrack.MODE_STREAM);
            }

            if (track == null || track.getState() != AudioTrack.STATE_INITIALIZED) {
                Log.e(TAG, "AudioTrack init failed");
                return;
            }

            track.play();
            int offset = 0;
            while (offset < samples) {
                int w = track.write(pcm, offset, Math.min(4096, samples - offset));
                if (w < 0) break;
                offset += w;
            }

            long start = System.currentTimeMillis();
            while (track.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                if (track.getPlaybackHeadPosition() >= samples) break;
                if (System.currentTimeMillis() - start > 10000) break;
                try { Thread.sleep(20); } catch (InterruptedException e) { break; }
            }
        } catch (Throwable t) {
            Log.e(TAG, "playPcm failed", t);
        } finally {
            try { if (track != null) { track.stop(); track.release(); } } catch (Throwable ignored) {}
            abandonFocus();
        }
    }

    public void destroy() {
        try { nativeTerminate(); } catch (Throwable ignored) {}
        try { exec.shutdownNow(); } catch (Throwable ignored) {}
        ready = false;
    }

    private File ensureDataDir() {
        try {
            File outDir = new File(appContext.getFilesDir(), DATA_SUBDIR);
            File marker = new File(outDir, ".ok");
            if (marker.exists() && new File(outDir, "phondata").exists()) return outDir;
            Log.i(TAG, "extracting espeak data...");
            copyAssets(appContext.getAssets(), "espeak-ng-data", outDir);
            try { marker.createNewFile(); } catch (IOException ignored) {}
            return outDir;
        } catch (Throwable t) {
            Log.e(TAG, "ensureDataDir failed", t);
            return null;
        }
    }

    private static void copyAssets(AssetManager am, String srcPath, File dstDir) throws IOException {
        if (!dstDir.exists() && !dstDir.mkdirs()) throw new IOException("mkdirs failed: " + dstDir);
        String[] files = am.list(srcPath);
        if (files == null || files.length == 0) throw new IOException("empty assets: " + srcPath);
        for (String name : files) {
            String src = srcPath + "/" + name;
            File dst = new File(dstDir, name);
            String[] child = am.list(src);
            if (child != null && child.length > 0) copyAssets(am, src, dst);
            else {
                if (dst.exists()) continue;
                try (InputStream in = am.open(src); OutputStream out = new FileOutputStream(dst)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
            }
        }
    }
}
