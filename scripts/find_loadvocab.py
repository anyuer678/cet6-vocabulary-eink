#!/usr/bin/env python3
"""查 loadVocabulary 函数"""
import re
from pathlib import Path

src = Path("c:/Users/30816/Desktop/项目/word/www/index.html")
text = src.read_text(encoding="utf-8", errors="replace")

m = re.search(r"function\s+loadVocabulary", text)
if m:
    print(f"Found at {m.start()}")
    # 找函数体结束 - 下一个 function 或 闭合大括号
    body_start = m.end()
    # 找 } 结束
    depth = 0
    i = body_start
    while i < len(text):
        c = text[i]
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    print(text[body_start:i+1])
else:
    print("Not found - try alternative")
    # 看 'loadData' 是什么
    m2 = re.search(r"function\s+loadData", text)
    if m2:
        depth = 0
        i = m2.end()
        while i < len(text):
            c = text[i]
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0: break
            i += 1
        print("loadData():", text[m2.end():i+1][:2000])
