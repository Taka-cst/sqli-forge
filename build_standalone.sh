#!/usr/bin/env python3
import pathlib, re

root = pathlib.Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")
data = (root / "data.js").read_text(encoding="utf-8")
app = (root / "app.js").read_text(encoding="utf-8")

html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "</style>")
html = html.replace('<script src="data.js"></script>', "<script>\n" + data + "\n</script>")
html = html.replace('<script src="app.js"></script>', "<script>\n" + app + "\n</script>")

out = root / "dist" / "sqli_forge.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print("built:", out, f"({out.stat().st_size/1024:.1f} KB)")
