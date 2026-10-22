#!/usr/bin/env python3
"""et_runner.py — 启动浏览器，挂交互/控制台/网络监控，人/Agent 自由探索，自动落盘日志。

用法：
    python et_runner.py <url> <session_id> [--headful]
启动后：
- 在打开的浏览器中自由操作（--headful 可见），也可由 Agent 通过 mcp browser 工具远程操控；
- 按 Ctrl+C 结束，会在 reports/ 下生成 <session_id>_visited.json / _console.json / _screenshots/。
"""
from __future__ import annotations
import argparse, json, pathlib, sys, time, datetime, re
from playwright.sync_api import sync_playwright, Page

WS = re.compile(r"\s+")
def norm(s): return WS.sub(" ", (s or "").strip()).lower()[:80]

def current_view(page) -> str:
    h = page.evaluate("() => location.hash") or "#/home"
    m = re.match(r"#/([a-z0-9_-]+)", h); base = m.group(1) if m else "home"
    # 检测 Dialog
    dialogs = page.locator("[role='dialog']").all()
    open_dlg = None
    for d in dialogs:
        try:
            if d.is_visible():
                t = d.get_by_role("heading").first().text_content(timeout=500) or ""
                open_dlg = norm(t)
                break
        except Exception: continue
    if not open_dlg: return base
    if "会员" in open_dlg or "membership" in open_dlg or "queue" in open_dlg:
        # 进一步区分 ledger / redeem
        if page.get_by_role("heading", name=re.compile("积分明细|Points History")).first().is_visible():
            return f"{base}.member.ledger"
        if page.get_by_role("heading", name=re.compile("积分兑换|Redeem Points")).first().is_visible():
            return f"{base}.member.redeem"
        return f"{base}.member"
    if "演示控制台" in open_dlg or "demo console" in open_dlg:
        return f"{base}.console"
    return f"{base}.dialog"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("session_id")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--out-dir", default="reports")
    ap.add_argument("--wait-timeout", type=int, default=0, help="若>0，自动结束；否则等 Ctrl+C")
    args = ap.parse_args()

    out = pathlib.Path(args.out_dir); out.mkdir(parents=True, exist_ok=True)
    shots = out / f"{args.session_id}_screenshots"; shots.mkdir(exist_ok=True)
    visited_path = out / f"{args.session_id}_visited.json"
    console_path = out / f"{args.session_id}_console.json"

    visited = []
    console_logs = []

    # 注入交互监听脚本（通过事件委托在 document 上监听）
    INJECT = r"""
    (function(){
      if (window.__ET_HOOKED__) return;
      window.__ET_HOOKED__ = true;
      const send = (type, payload) => console.debug('ET_VISIT', JSON.stringify({type, payload, t: Date.now()}));
      const desc = (el) => {
        if (!el) return null;
        const role = el.getAttribute && (el.getAttribute('role') || (el.tagName==='A'?'link':el.tagName.toLowerCase()));
        const name = (el.getAttribute && (el.getAttribute('aria-label') || el.innerText || el.value || el.id)) || '';
        return { tag: el.tagName && el.tagName.toLowerCase(), role, name: String(name).trim().slice(0,80) };
      };
      const handler = (type) => (e) => {
        const t = e.target;
        const d = desc(t);
        if (!d) return;
        send(type, d);
      };
      ['click','change','input','keydown','submit'].forEach(ev =>
        document.addEventListener(ev, handler(ev), true)
      );
      // 监控 fill/select 变化
      document.addEventListener('focusout', (e) => {
        const t = e.target;
        if (t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT')) {
          send('fill', { ...desc(t), value: String(t.value||'').slice(0,80) });
        }
      }, true);
    })();
    """

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful, args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width":1280,"height":720}, locale="zh-CN")
        page = ctx.new_page()

        page.on("console", lambda msg: (
            console_logs.append({"t": datetime.datetime.now().isoformat(), "type": msg.type, "text": msg.text[:500]})
        ))
        page.on("pageerror", lambda err: (
            console_logs.append({"t": datetime.datetime.now().isoformat(), "type": "pageerror", "text": str(err)[:500]})
        ))
        page.on("requestfailed", lambda req: (
            console_logs.append({"t": datetime.datetime.now().isoformat(), "type": "requestfailed",
                                 "url": req.url, "failure": req.failure and req.failure.error_text})
        ))

        page.goto(args.url, wait_until="networkidle")
        page.add_init_script(INJECT)
        page.reload(wait_until="networkidle")

        # 收集 ET_VISIT 事件
        def on_console(msg):
            if msg.type == "debug" and msg.text.startswith("ET_VISIT "):
                try:
                    data = json.loads(msg.text[len("ET_VISIT "):])
                except Exception: return
                view = current_view(page)
                role = (data.get("payload") or {}).get("role") or ""
                name = norm((data.get("payload") or {}).get("name") or "")
                if role and name:
                    key = f"{view}::{role}::{name}"
                    visited.append({"t": data["t"], "key": key, "view": view, "type": data["type"], "name": name, "role": role})
        page.on("console", on_console)

        print(f"[runner] open {args.url}, session {args.session_id}", file=sys.stderr)
        print(f"[runner] exploring... press Ctrl+C to stop.", file=sys.stderr)

        try:
            if args.wait_timeout > 0:
                time.sleep(args.wait_timeout)
            else:
                # 等待用户/Agent 操作：每 30 秒落盘一次
                while True:
                    time.sleep(30)
                    visited_path.write_text(json.dumps(visited, ensure_ascii=False, indent=2), encoding="utf-8")
                    console_path.write_text(json.dumps(console_logs, ensure_ascii=False, indent=2), encoding="utf-8")
        except KeyboardInterrupt:
            pass
        finally:
            # 最终截图
            page.screenshot(path=str(shots / "final.png"), full_page=True)
            visited_path.write_text(json.dumps(visited, ensure_ascii=False, indent=2), encoding="utf-8")
            console_path.write_text(json.dumps(console_logs, ensure_ascii=False, indent=2), encoding="utf-8")
            ctx.close(); browser.close()

    # 去重统计
    uniq = sorted({v["key"] for v in visited})
    summary = {
        "session_id": args.session_id,
        "url": args.url,
        "total_events": len(visited),
        "unique_elements": len(uniq),
        "visited_keys": uniq,
        "console_errors": [e for e in console_logs if e["type"] in {"error","pageerror","requestfailed"}],
        "console_warnings": [e for e in console_logs if e["type"] == "warning"],
    }
    (out / f"{args.session_id}_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] visited {summary['unique_elements']} unique elements, "
          f"console errors: {len(summary['console_errors'])}", file=sys.stderr)

if __name__ == "__main__":
    main()
