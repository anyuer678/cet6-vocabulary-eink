#!/usr/bin/env python3
"""测试 edge-tts 输出格式与大小"""
import asyncio
import edge_tts
from pathlib import Path

async def test():
    out = Path("c:/Users/30816/Desktop/项目/word/scripts/_test")
    out.mkdir(exist_ok=True)
    for voice in ["en-US-AriaNeural", "en-US-JennyNeural", "en-GB-RyanNeural"]:
        for rate in ["-10%", "+0%", "+5%"]:
            comm = edge_tts.Communicate("hello world", voice, rate=rate)
            f = out / f"test_{voice}_{rate}.mp3"
            await comm.save(str(f))
            if f.exists():
                print(f"  {f.name}: {f.stat().st_size} bytes")
            else:
                print(f"  {f.name}: FAILED")

asyncio.run(test())
