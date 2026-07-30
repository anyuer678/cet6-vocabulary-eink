"""
从 word/www/index.html 和 word/www-eink/index.html 提取 EMBEDDED_VOCABULARY
并保存为两项目各自的 cet6-words.json
"""
import json
import re
import sys
import os

SOURCES = [
    r"c:\Users\30816\Desktop\新建文件夹\word\www\index.html",
    r"c:\Users\30816\Desktop\新建文件夹\word\www-eink\index.html",
]
TARGETS = [
    r"c:\Users\30816\Desktop\新建文件夹\word\www\data\cet6-words.json",
    r"c:\Users\30816\Desktop\新建文件夹\word\www-eink\data\cet6-words.json",
]

PATTERN = re.compile(r'var\s+EMBEDDED_VOCABULARY\s*=\s*(\[.*?\]);', re.DOTALL)

for src, dst in zip(SOURCES, TARGETS):
    if not os.path.exists(src):
        print(f"❌ 源文件不存在: {src}")
        sys.exit(1)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(src, 'r', encoding='utf-8') as f:
        content = f.read()
    m = PATTERN.search(content)
    if not m:
        print(f"❌ 未找到 EMBEDDED_VOCABULARY: {src}")
        sys.exit(1)
    raw = m.group(1)
    try:
        vocab = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {src} - {e}")
        sys.exit(1)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, separators=(',', ':'))
    src_size = len(raw)
    dst_size = os.path.getsize(dst)
    print(f"✓ {src.split(chr(92))[-2]:12} → {dst.split(chr(92))[-2]:12}")
    print(f"  词条: {len(vocab):,}  原内联: {src_size:,} B  JSON: {dst_size:,} B  节省: {src_size - dst_size:,} B")
print("完成。")
