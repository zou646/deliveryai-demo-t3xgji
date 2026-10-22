#!/usr/bin/env python3
"""et_enumerate.py — 打开被测站点，枚举每个路由/弹窗下的可交互元素，输出 E_actual inventory。

用法：
    python et_enumerate.py <url> <out_json> [--routes home,welcome,menu,order,checkout]
默认按 routes 列表逐页访问，并尝试打开会员弹窗/DemoConsole 以枚举 Dialog 内元素。
"""
from __future__ import annotations
import argparse, json, re, time, pathlib, sys
from playwright.sync_api import sync_playwright, Page

WS = re.compile(r"\s+")
def norm(s): return WS.sub(" ", (s or "").strip()).lower()

def current_view(page: Page) -> str:
    h = page.evaluate("() => location.hash") or "#/home"
    m = re.match(r"#/([a-z0-9_-]+)", h)
    return m.group(1) if m else "home"

def collect_interactive(page: Page, subview: str = ""):
    """返回当前页面所有可交互元素的 {role, name, selector, disabled} 列表。"""
    js = """() => {
      const out = [];
      const push = (el, role, name) => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return;
        out.push({
          role, name: (name || el.getAttribute('aria-label') || el.innerText || el.value || '').trim(),
          text: (el.innerText||'').trim().slice(0,80),
          disabled: !!el.disabled || el.getAttribute('aria-disabled')==='true',
          tag: el.tagName.toLowerCase()
        });
      };
      document.querySelectorAll('button, a[href], input, select, textarea, [tabindex], [role]').forEach(el => {
        const r = el.getAttribute('role') || (el.tagName.toLowerCase()==='a'?'link':el.tagName.toLowerCase());
        push(el, r, el.getAttribute('aria-label') || '');
      });
      return out;
    }"""
    raw = page.evaluate(js)
    view = current_view(page)
    prefix = f"{view}{subview}"
    items = {}
    for r in raw:
        name = norm(r.get("name") or r.get("text") or "")
        if not name: continue
        # 过滤明显噪音
        if r["role"] in {"script","style","html","body"}: continue
        if len(name) > 80: name = name[:80]
        key = f"{prefix}::{r['role']}::{name}"
        items[key] = {"view": prefix, "role": r["role"], "name": name, "disabled": r["disabled"], "tag": r["tag"]}
    return items

def try_open_dialogs(page: Page, items: dict):
    """尝试打开会员弹窗/DemoConsole/菜品规格弹窗，枚举其内部元素。"""
    # 会员与排号
    for name_pat in [/会员与排号|Membership & Queue/, /演示控制台|Demo Console/]:
        try:
            btn = page.getByRole("button", name=name_pat).first()
            if btn.is_visible():
                btn.click()
                page.waitForTimeout(400)
                sub = ".member" if "会员" in name_pat.pattern or "Membership" in name_pat.pattern else ".console"
                items.update(collect_interactive(page, sub))
                # 在会员弹窗里，点积分明细/积分兑换
                if sub == ".member":
                    for subname, subkey in [("积分明细|Points History", ".member.ledger"),
                                            ("积分兑换|Redeem Points", ".member.redeem")]:
                        try:
                            subbtn = page.getByRole("button", name=re.compile(subname)).first()
                            if subbtn.is_visible():
                                subbtn.click()
                                page.waitForTimeout(300)
                                items.update(collect_interactive(page, subkey))
                                page.keyboard.press("Escape")
                                page.waitForTimeout(200)
                        except Exception: pass
                page.keyboard.press("Escape")
                page.waitForTimeout(300)
        except Exception:
            pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("out_json")
    ap.add_argument("--routes", default="home,welcome,menu,order,checkout")
    ap.add_argument("--wait-ms", type=int, default=800)
    args = ap.parse_args()

    all_items = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width":1280,"height":720}, locale="zh-CN")
        page = ctx.new_page()
        page.goto(args.url, wait_until="networkidle")
        for route in args.routes.split(","):
            route = route.strip()
            page.goto(f"{args.url}#/{route}", wait_until="networkidle")
            page.waitForTimeout(args.wait_ms)
            all_items.update(collect_interactive(page, ""))
            try_open_dialogs(page, all_items)
        ctx.close(); browser.close()

    out = {
        "url": args.url,
        "routes": args.routes.split(","),
        "elements": all_items,
        "count": len(all_items),
    }
    pathlib.Path(args.out_json).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] collected {out['count']} elements -> {args.out_json}", file=sys.stderr)

if __name__ == "__main__":
    main()
