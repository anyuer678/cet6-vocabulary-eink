#!/usr/bin/env python3
"""方案：生成 100+ 英语音素/字母组合的音频片段
+ 5000 单词的预录音频
两者并行：单词用低优先级后台，音素先做
"""
import asyncio
import edge_tts
from pathlib import Path

# 音素列表（基于 CMU 简化）
PHONEMES = [
    # 元音（短）
    "ae", "ah", "eh", "ih", "oh", "uh", "er",
    # 元音（长）
    "ay", "ee", "eye", "ow", "oo", "oy",
    # 辅音
    "b", "ch", "d", "f", "g", "h", "j", "k", "l", "m",
    "n", "ng", "p", "r", "s", "sh", "t", "th", "v", "w",
    "y", "z", "zh",
    # 字母（用于慢读）
    *[chr(c) for c in range(ord('a'), ord('z')+1)],
    # 常见字母组合
    "ar", "or", "ur", "air", "ear", "ire", "ure",
    "tion", "sion", "ough", "augh", "ight", "eigh",
    "ph", "gh", "wh", "ck", "qu",
]
VOICE = "en-US-AriaNeural"

async def gen_one(sem, text, out_path, label):
    async with sem:
        if out_path.exists() and out_path.stat().st_size > 500:
            return
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, VOICE, rate="+0%")
                await comm.save(str(out_path))
                if out_path.exists() and out_path.stat().st_size > 500:
                    break
            except Exception as e:
                if attempt == 2:
                    print(f"FAIL {label}: {e}", flush=True)
                else:
                    await asyncio.sleep(0.5)

async def gen_words():
    """生成 5000 词"""
    WORDS = Path("c:/Users/30816/Desktop/项目/word/scripts/words.txt")
    OUT = Path("c:/Users/30816/Desktop/项目/word/scripts/audio")
    OUT.mkdir(parents=True, exist_ok=True)
    words = [w.strip() for w in WORDS.read_text(encoding="utf-8").splitlines() if w.strip()]
    sem = asyncio.Semaphore(8)
    tasks = []
    for w in words:
        safe = "".join(c if c.isalnum() else "_" for c in w).lower()
        out = OUT / f"{safe}.mp3"
        tasks.append(gen_one(sem, w, out, w))
    await asyncio.gather(*tasks)
    # 统计
    files = list(OUT.glob("*.mp3"))
    total = sum(f.stat().st_size for f in files)
    print(f"Words done: {len(files)} files, {total/1024/1024:.1f} MB", flush=True)

async def gen_phonemes():
    """生成 100 音素 + 字母"""
    OUT = Path("c:/Users/30816/Desktop/项目/word/scripts/phonemes")
    OUT.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(4)
    tasks = []
    for ph in PHONEMES:
        out = OUT / f"{ph.replace(' ','_')}.mp3"
        # 对字母和组合，读拼写
        if len(ph) == 1 and ph.isalpha():
            text = ph
        else:
            text = ph
        tasks.append(gen_one(sem, text, out, ph))
    await asyncio.gather(*tasks)
    files = list(OUT.glob("*.mp3"))
    total = sum(f.stat().st_size for f in files)
    print(f"Phonemes done: {len(files)} files, {total/1024:.1f} KB", flush=True)

async def main():
    # 先生成音素（快速），再生成单词（慢）
    await gen_phonemes()
    await gen_words()

asyncio.run(main())
