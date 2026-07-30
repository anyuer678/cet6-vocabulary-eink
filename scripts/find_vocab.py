#!/usr/bin/env python3
"""找 vocabulary 在 index.html 中的位置"""
import re
from pathlib import Path

src = Path("c:/Users/30816/Desktop/项目/word/www/index.html")
text = src.read_text(encoding="utf-8", errors="replace")
print(f"File length: {len(text)}")
# 找所有 'vocabulary' 不分大小写
for m in re.finditer(r"(?i)vocabulary", text):
    print(f"  pos={m.start()} ctx={text[max(0,m.start()-40):m.start()+80]!r}")
