#!/usr/bin/env python3
"""批量生成 CET6 单词音频
- 异步并发（10 个）
- 失败重试
- 进度日志
"""
import asyncio
import sys
import time
from pathlib import Path
import edge_tts

WORDS_FILE = Path("c:/Users/30816/Desktop/项目/word/scripts/words.txt")
OUT_DIR = Path("c:/Users/30816/Desktop/项目/word/scripts/audio")
VOICE = "en-US-AriaNeural"  # 美式女声
RATE = "+0%"
CONCURRENCY = 8
RETRY = 3

async def gen_one(sem, word, idx, total):
    async with sem:
        safe = "".join(c if c.isalnum() else "_" for c in word).lower()
        out = OUT_DIR / f"{safe}.mp3"
        if out.exists() and out.stat().st_size > 500:
            return  # 跳过已存在
        for attempt in range(RETRY):
            try:
                comm = edge_tts.Communicate(word, VOICE, rate=RATE)
                await comm.save(str(out))
                if out.exists() and out.stat().st_size > 500:
                    break
            except Exception as e:
                if attempt == RETRY - 1:
                    print(f"  FAIL {word}: {e}", flush=True)
                else:
                    await asyncio.sleep(1)
        if idx % 100 == 0 or idx == total:
            print(f"  [{idx}/{total}] {word} -> {out.name} ({out.stat().st_size if out.exists() else 0} bytes)", flush=True)

async def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    words = [w.strip() for w in WORDS_FILE.read_text(encoding="utf-8").splitlines() if w.strip()]
    total = len(words)
    print(f"Generating {total} words, voice={VOICE}, concurrency={CONCURRENCY}", flush=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    start = time.time()
    tasks = [gen_one(sem, w, i, total) for i, w in enumerate(words, 1)]
    await asyncio.gather(*tasks)
    elapsed = time.time() - start
    print(f"Done in {elapsed:.1f}s", flush=True)

    # 统计
    files = list(OUT_DIR.glob("*.mp3"))
    total_size = sum(f.stat().st_size for f in files)
    print(f"Generated {len(files)} files, total {total_size/1024/1024:.1f} MB, avg {total_size/len(files)/1024:.1f} KB", flush=True)

asyncio.run(main())
