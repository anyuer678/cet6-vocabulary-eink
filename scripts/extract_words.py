#!/usr/bin/env python3
"""从 EMBEDDED_VOCABULARY 提取单词"""
import re
import json
from pathlib import Path

src = Path("c:/Users/30816/Desktop/项目/word/www/index.html")
text = src.read_text(encoding="utf-8", errors="replace")
m = re.search(r"EMBEDDED_VOCABULARY\s*=\s*(\[.*?\]);", text, re.DOTALL)
if not m:
    print("ERROR: EMBEDDED_VOCABULARY not found")
    raise SystemExit(1)
arr = m.group(1)
data = json.loads(arr)
print(f"Loaded {len(data)} entries")

words = []
seen = set()
for it in data:
    w = it.get("word", "").strip()
    if not w or w.lower() in seen:
        continue
    seen.add(w.lower())
    words.append(w)

out_words = Path("c:/Users/30816/Desktop/项目/word/scripts/words.txt")
out_json = Path("c:/Users/30816/Desktop/项目/word/scripts/words.json")
out_words.parent.mkdir(parents=True, exist_ok=True)
out_words.write_text("\n".join(words) + "\n", encoding="utf-8")
out_json.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")

print(f"Wrote {len(words)} unique words to {out_words}")
print(f"First 5: {words[:5]}")
print(f"Last 5: {words[-5:]}")
