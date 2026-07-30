#!/usr/bin/env python3
"""查 loadVocabulary 函数定义"""
import re
from pathlib import Path

src = Path("c:/Users/30816/Desktop/项目/word/www/index.html")
text = src.read_text(encoding="utf-8", errors="replace")

for fname in ["vocabulary","Vocab","vocab","VocabData","wordData","wordList","words","WordList"]:
    for m in re.finditer(fname, text):
        # 跳过函数调用
        ctx = text[max(0,m.start()-50):m.start()+100]
        if "function" in ctx or "load" in ctx or "var " in ctx or "let " in ctx or "const " in ctx:
            print(f"== {fname} pos={m.start()} ==")
            print(f"  ctx: {ctx!r}")
            print()
