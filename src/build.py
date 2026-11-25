import os
base = os.path.dirname(os.path.abspath(__file__))
parts = ["00_head.html","10_core.js","20_sprites.js","30_worldgen.js","35_tactics.js","40_game.js","42_progress.js","45_items.js","47_events.js","50_render.js","60_ui.js","99_tail.html"]
out = os.path.join(base, "..", "..", "downloads", "tiny-pixel-rogue.html")
buf = []
for p in parts:
    with open(os.path.join(base,p), encoding="utf-8") as f:
        buf.append(f.read().rstrip("\n"))
html = "\n".join(buf) + "\n"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("wrote", out, len(html), "bytes")
