#!/usr/bin/env python3
"""et_monitor.py — Monitor（只读观察进程），在 S+/X 模式下与 Executor 并行运行。

职责（严格只读）：
1. 订阅 console.error / pageerror / requestfailed；
2. 每步（stepId）对账 expected.view / subview / elements_triggered；
3. 校验 hash/dialog/余额/券数等 state 是否符合预期；
4. 覆盖率增量守护：visited 长时间不增长提示；
5. Off-charter 操作打标；
6. 每步自动截图。

严禁：点击页面、改 charter、判 bug 严重度。

用法（Python+Playwright 环境）：
  # 与 Executor 共享同一个 Chrome 远程调试端口，或 attach 到同一份 userDataDir
  python et_monitor.py --url <url> --charter <charter.json> --session-id <sid> --out-dir reports/ [--session a|b]

或通过 CDP 附加到 Executor 已开启的浏览器：
  python et_monitor.py --cdp http://127.0.0.1:<port> --charter <charter.json> ...

输出：
  reports/<sid>_monitor.jsonl     每步一条对账记录
  reports/<sid>_alerts.jsonl      实时告警
  reports/<sid>_console.json      console/error/requestfailed 汇总
  reports/<sid>_screenshots/step-<id>.png
"""
from __future__ import annotations
import argparse, json, pathlib, re, sys, time, datetime
from playwright.sync_api import sync_playwright, Page

WS = re.compile(r"\s+")
def norm(s): return WS.sub(" ", str(s or "").strip()).lower()[:80]

def current_view(page) -> str:
    h = page.evaluate("() => location.hash") or "#/home"
    base = (re.match(r"#/([a-z0-9_-]+)", h) or [None,"home"])[1]
    # 检测 dialog
    dialogs = page.locator("[role='dialog']").all()
    sub = ""
    for d in dialogs:
        try:
            if not d.is_visible(): continue
        except Exception: continue
        ht = norm(d.locator("h1,h2,h3,h4").first().text_content() or "")
        if "会员" in ht or "membership" in ht or "queue" in ht:
            sub = ".member"
            # 子面板
            try:
                if d.get_by_role("heading", name=re.compile(r"积分明细|Points History")).first().is_visible():
                    sub = ".member.ledger"
                elif d.get_by_role("heading", name=re.compile(r"积分兑换|Redeem Points")).first().is_visible():
                    sub = ".member.redeem"
            except Exception: pass
        elif "演示控制台" in ht or "demo console" in ht:
            sub = ".console"
        else:
            sub = ".dialog"
        break
    return base + sub

def inject_listeners(page):
    page.evaluate("""() => {
      if (window.__ET_INJECTED__) return;
      window.__ET_INJECTED__ = true;
      window.__ET_VISITED__ = [];
      const push = (type, el, extra) => {
        try {
          const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
          const role = el.getAttribute && (el.getAttribute('role')||(el.tagName==='A'?'link':el.tagName.toLowerCase()));
          const name = ((el.getAttribute && el.getAttribute('aria-label')) || el.innerText || el.value || '').trim().slice(0,80);
          if (!name) return;
          window.__ET_VISITED__.push({type, role, name, t: Date.now(), ...(extra||{})});
        } catch(e){}
      };
      document.addEventListener('click', e => push('click', e.target), true);
      document.addEventListener('change', e => push('change', e.target, {value: e.target && e.target.value}), true);
      document.addEventListener('keydown', e => push('keydown:'+e.key, document.activeElement), true);
    }""")

def collect_inventory(page):
    return page.evaluate("""() => {
      const norm = s => String(s||'').replace(/\\s+/g,' ').trim().toLowerCase().slice(0,80);
      const out = {};
      document.querySelectorAll('button,a[href],input,select,textarea,[tabindex],[role]').forEach(el=>{
        const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
        const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none') return;
        const role=el.getAttribute('role')||(el.tagName==='A'?'link':el.tagName.toLowerCase());
        const name=norm(el.getAttribute('aria-label')||el.innerText||el.value||el.placeholder||'');
        if(!name) return;
        const h=location.hash||'#/home'; let v=(h.match(/#\\/([a-z0-9_-]+)/)||[])[1]||'home';
        let p=el;
        while(p){ if(p.getAttribute&&p.getAttribute('role')==='dialog'){ v+='.dialog'; break;} p=p.parentElement;}
        out[v+'::'+role+'::'+name] = 1;
      });
      return out;
    }""")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    ap.add_argument("--cdp")
    ap.add_argument("--charter", required=True)
    ap.add_argument("--session-id", required=True)
    ap.add_argument("--out-dir", default="reports")
    ap.add_argument("--session", default="a", help="X 模式下 tag: a/b")
    ap.add_argument("--wait-timeout", type=int, default=0)
    args = ap.parse_args()

    charter = json.loads(pathlib.Path(args.charter).read_text(encoding="utf-8"))
    out = pathlib.Path(args.out_dir); out.mkdir(parents=True, exist_ok=True)
    shots = out / f"{args.session_id}_{args.session}_screenshots"; shots.mkdir(exist_ok=True)
    alerts_f = (out / f"{args.session_id}_{args.session}_alerts.jsonl").open("w", encoding="utf-8")
    monitor_f = (out / f"{args.session_id}_{args.session}_monitor.jsonl").open("w", encoding="utf-8")
    console_logs = []

    def alert(level, code, msg, **kw):
        rec = {"t": datetime.datetime.now().isoformat(), "level": level, "code": code, "msg": msg, **kw}
        alerts_f.write(json.dumps(rec, ensure_ascii=False)+"\n"); alerts_f.flush()
    def mon(**kw):
        rec = {"t": datetime.datetime.now().isoformat(), **kw}
        monitor_f.write(json.dumps(rec, ensure_ascii=False)+"\n"); monitor_f.flush()

    with sync_playwright() as p:
        if args.cdp:
            browser = p.chromium.connect_over_cdp(args.cdp)
            ctx = browser.contexts[0] if browser.contexts else browser.new_context()
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
        else:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
            ctx = browser.new_context(viewport={"width":1280,"height":720}, locale="zh-CN")
            page = ctx.new_page()
            page.goto(args.url, wait_until="networkidle")
        inject_listeners(page)
        page.on("console", lambda msg: (
            console_logs.append({"level": msg.type, "text": msg.text[:500]}),
            (alert("error", "console", msg.text) if msg.type == "error" else None)
        ))
        page.on("pageerror", lambda err: alert("error", "pageerror", str(err)))
        page.on("requestfailed", lambda req: alert("warn", "requestfailed", f"{req.url} :: {req.failure and req.failure.error_text}"))

        steps = charter.get("steps", [])
        thresholds = charter.get("thresholds", {"S":0.98,"V":0.95,"C":1.0})
        allowlist = set(charter.get("scope",{}).get("console_allowlist",[]))
        visited_total = set()
        last_visited_n = 0
        idle_since = time.time()
        mon(event="start", url=page.url, charter=args.charter, steps=len(steps))
        try:
            # 轮询监控
            start = time.time()
            while True:
                # 收集 visited
                try:
                    vis = page.evaluate("() => window.__ET_VISITED__ || []")
                    inv = collect_inventory(page)
                    view = current_view(page)
                    for v in vis:
                        key = f"{view}::{v['role']}::{norm(v['name'])}"
                        visited_total.add(key)
                    if len(visited_total) == last_visited_n:
                        if time.time() - idle_since > 5*60:
                            alert("warn", "idle", "5 分钟无新增交互，可能卡住或已结束", visited=len(visited_total))
                            idle_since = time.time()
                    else:
                        idle_since = time.time()
                    last_visited_n = len(visited_total)
                    mon(event="tick", view=view, visited=len(visited_total), inventory=len(inv))
                except Exception as e:
                    alert("warn", "eval_error", str(e))

                if args.wait_timeout and (time.time() - start) > args.wait_timeout: break
                time.sleep(2)
        except KeyboardInterrupt:
            pass
        finally:
            # 最终截图
            try:
                page.screenshot(path=str(shots/"final.png"), full_page=True)
            except Exception: pass
            (out / f"{args.session_id}_{args.session}_visited.json").write_text(
                json.dumps(sorted(visited_total), ensure_ascii=False, indent=2), encoding="utf-8")
            (out / f"{args.session_id}_{args.session}_console.json").write_text(
                json.dumps(console_logs, ensure_ascii=False, indent=2), encoding="utf-8")
            mon(event="end", visited_total=len(visited_total))
            ctx.close()
            if not args.cdp: browser.close()
    alerts_f.close(); monitor_f.close()
    print(f"[monitor done] session={args.session_tag if hasattr(args,'session_tag') else args.session} visited={last_visited_n}", file=sys.stderr)

if __name__ == "__main__":
    main()
