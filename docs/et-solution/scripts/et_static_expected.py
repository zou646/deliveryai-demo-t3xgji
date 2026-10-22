#!/usr/bin/env python3
"""et_static_expected.py — 从 TSX 源码静态扫描期望交互元素，输出 E_expected JSON。

用法：
    python et_static_expected.py <repo_root>
输出：stdout JSON

扫描规则：
- getByRole(/role[^\n]*name[^)]*\)/i 形式（粗略正则，覆盖 Playwright 风格的 getByRole）
- aria-label="..." / aria-label={t('xxx')}
- role="button|link|tab|dialog|textbox|..."
- /* et:element <role> <name> on <view> */ 显式注释标记
- 从 <Route path="#/xxx" component={XxxView}/> 或 useViewRoute 的 VIEWS 数组抽视图名
"""
from __future__ import annotations
import json, re, sys, pathlib

ROLE_RE = re.compile(r"getByRole\(\s*['\"](\w+)['\"][^)]*?name\s*:\s*(?:/([^/]+)/|['\"]([^'\"]+)['\"])", re.S)
ARIA_RE = re.compile(r"""aria-label=(?:"([^"]+)"|\{[^}]*\bt\(\s*['"]([^'"]+)['\"]\)[^}]*\}|'([^']+)')""")
ROLE_ATTR_RE = re.compile(r"""role\s*=\s*['"](\w+)['"][^>]*aria-label\s*=\s*(?:"([^"]+)"|\{'([^']+)'\}|"([^"]+)")""", re.S)
COMMENT_TAG_RE = re.compile(r"/\*\s*et:element\s+(\w+)\s+(.+?)\s+on\s+(\S+)\s*\*/")
VIEW_RE = re.compile(r"['\"](#/[a-z0-9_-]+)['\"]")
HASH_RE = re.compile(r"#/([a-z0-9_-]+)")

TEXT_WHITESPACE = re.compile(r"\s+")

def norm_name(s: str) -> str:
    return TEXT_WHITESPACE.sub(" ", (s or "").strip()).lower()

def infer_view(path: pathlib.Path, code: str) -> str:
    name = path.stem.lower()
    # XxxView.tsx → xxx
    if name.endswith("view"):
        return name[:-4]
    # 从注释/文件名推断
    if "topbar" in name or "member" in name:
        return "topbar"
    if "checkout" in name:
        return "checkout"
    if "menu" in name:
        return "menu"
    if "order" in name:
        return "order"
    if "console" in name or "demo" in name:
        return "console"
    return name or "unknown"

def scan_file(path: pathlib.Path):
    try:
        code = path.read_text(encoding="utf-8")
    except Exception:
        return []
    view = infer_view(path, code)
    items = []

    # 显式注释标记
    for m in COMMENT_TAG_RE.finditer(code):
        role, name, v = m.group(1), m.group(2), m.group(3)
        items.append((v, role, norm_name(name), "comment-tag"))

    # getByRole
    for m in ROLE_RE.finditer(code):
        role, reg, lit = m.group(1), m.group(2), m.group(3)
        name = norm_name(reg or lit or "")
        if name and role in {"button","link","tab","dialog","textbox","menuitem","checkbox","radio"}:
            items.append((view, role, name, "getByRole"))

    # role=... + aria-label
    for m in ROLE_ATTR_RE.finditer(code):
        role = m.group(1)
        name = norm_name(next((g for g in m.groups()[1:] if g), ""))
        if name:
            items.append((view, role, name, "role-attr"))

    # aria-label 独立出现（默认 role=button/link）
    for m in ARIA_RE.finditer(code):
        name = norm_name(next((g for g in m.groups() if g), ""))
        if name:
            items.append((view, "button", name, "aria-label"))

    return items

def scan_views(root: pathlib.Path):
    views = set()
    # 从 useViewRoute / App 中找 #/xxx
    for p in root.rglob("*.tsx"):
        if "node_modules" in p.parts or "dist" in p.parts:
            continue
        try:
            code = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for m in HASH_RE.finditer(code):
            views.add(m.group(1))
    # *View.tsx
    for p in (root / "src" / "components").glob("*View.tsx") if (root/"src"/"components").exists() else []:
        vn = p.stem[:-4].lower()
        if vn not in {"app"}:
            views.add(vn)
    return sorted(views)

def main():
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr); sys.exit(2)
    root = pathlib.Path(sys.argv[1]).resolve()
    elements = {}
    for p in root.rglob("*.tsx"):
        if "node_modules" in p.parts or "dist" in p.parts or "e2e" in p.parts:
            continue
        for view, role, name, src in scan_file(p):
            key = f"{view}::{role}::{name}"
            elements[key] = {"view": view, "role": role, "name": name, "source": src, "file": str(p.relative_to(root))}
    out = {"views": scan_views(root), "elements": elements}
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
