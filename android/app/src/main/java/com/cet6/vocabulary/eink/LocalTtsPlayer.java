package com.cet6.vocabulary.eink;

import android.content.Context;
import android.content.res.AssetManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.util.Log;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 墨水屏版：纯离线字母/音素拼读
 */
public class LocalTtsPlayer {
    private static final String TAG = "LocalTtsPlayer";
    private static final String PHON_DIR = "public/phon/";

    private final Context appContext;
    private final AssetManager assets;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private MediaPlayer player;
    private final Deque<String> queue = new ArrayDeque<>();
    private volatile boolean playing = false;

    public LocalTtsPlayer(Context context) {
        this.appContext = context.getApplicationContext();
        this.assets = appContext.getAssets();
    }

    public void speak(final String text) {
        if (text == null || text.isEmpty()) return;
        exec.execute(new Runnable() {
            @Override public void run() {
                enqueue(text);
                drain();
            }
        });
    }

    public void stop() {
        exec.execute(new Runnable() {
            @Override public void run() {
                queue.clear();
                releasePlayer();
                playing = false;
            }
        });
    }

    public int getPhonCount() {
        try {
            String[] list = assets.list(PHON_DIR);
            return list == null ? 0 : list.length;
        } catch (IOException e) { return 0; }
    }

    private void enqueue(String text) {
        String key = text.trim().toLowerCase();
        if (key.isEmpty()) return;
        for (String p : splitForPhonemes(key)) {
            String pp = PHON_DIR + p + ".mp3";
            if (fileExists(pp)) queue.addLast(pp);
        }
    }

    private void drain() {
        if (playing) return;
        if (queue.isEmpty()) return;
        playing = true;
        try {
            while (!queue.isEmpty()) {
                String path = queue.pollFirst();
                playOne(path);
            }
        } finally {
            playing = false;
        }
    }

    private boolean playOne(String assetPath) {
        android.content.res.AssetFileDescriptor afd = null;
        try {
            releasePlayer();
            player = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            } else {
                player.setAudioStreamType(AudioManager.STREAM_MUSIC);
            }
            afd = assets.openFd(assetPath);
            player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            player.prepare();
            player.start();
            long start = System.currentTimeMillis();
            while (player != null && player.isPlaying()) {
                if (System.currentTimeMillis() - start > 15000) break;
                try { Thread.sleep(50); } catch (InterruptedException e) { break; }
            }
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "playOne failed: " + assetPath, t);
            return false;
        } finally {
            try { if (afd != null) afd.close(); } catch (Throwable ignored) {}
            releasePlayer();
        }
    }

    private void releasePlayer() {
        try {
            if (player != null) {
                if (player.isPlaying()) { try { player.stop(); } catch (Throwable ignored) {} }
                player.reset();
                player.release();
            }
        } catch (Throwable ignored) {}
        player = null;
    }

    private boolean fileExists(String path) {
        try { assets.open(path).close(); return true; } catch (IOException e) { return false; }
    }

    private static String[] splitForPhonemes(String s) {
        java.util.List<String> out = new java.util.ArrayList<>();
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (!Character.isLetter(c)) { i++; continue; }
            boolean matched = false;
            for (int len = 4; len >= 2; len--) {
                if (i + len <= s.length()) {
                    String combo = s.substring(i, i + len);
                    if (PHONEMES.contains(combo)) {
                        out.add(combo);
                        i += len;
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) { out.add(String.valueOf(c)); i++; }
        }
        return out.toArray(new String[0]);
    }

    private static final java.util.Set<String> PHONEMES = new java.util.HashSet<>(java.util.Arrays.asList(
        "th","sh","ch","ph","wh","gh","ck","qu","ng",
        "ar","or","ur","er","ir","ow","oy","aw","ew",
        "ay","ee","ea","ie","oo","ou","ai","oa","ui","ue",
        "kn","wr","gn","mb","lk",
        "tch","scr","shr","spl","spr","str","thr","sch",
        "tion","sion","ough","augh","ight","eigh"
    ));

    public void destroy() {
        try { queue.clear(); releasePlayer(); exec.shutdownNow(); } catch (Throwable ignored) {}
    }
}
