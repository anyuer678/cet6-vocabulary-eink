#!/usr/bin/env python3
"""直接打印 loadVocabulary 上下文"""
from pathlib import Path
src = Path("c:/Users/30816/Desktop/项目/word/www/index.html")
text = src.read_text(encoding="utf-8", errors="replace")
i = text.find("function loadVocabulary")
if i < 0:
    print("not found")
else:
    print(text[i:i+3000])
