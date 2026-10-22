#!/usr/bin/env python3
"""et_diff.py — 对比 expected/inventory/visited，计算 S/V/C 指标，输出覆盖率 Markdown 片段 + JSON。

用法：
    python et_diff.py <expected.json> <inventory.json> <visited.json> [--reachable view1,view2,...]
输出 stdout 为 Markdown 片段，同时在 visited.json 同目录写 coverage.json。
"""
from __future__ import annotations
import argparse, json, pathlib, sys

def load(p): return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

def flatten(elements: dict) -> set:
    if isinstance(elements, dict) and "elements" in elements:
        return set(elements["elements"].keys())
    return set(elements.keys())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("expected")
    ap.add_argument("inventory")
    ap.add_argument("visited")
    ap.add_argument("--reachable", default="", help="逗号分隔的视图前缀白名单；空=全部 inventory")
    ap.add_argument("--exclude", action="append", default=[], help="可重复：从未覆盖清单中排除的 key 或前缀，格式 code:pattern，如 EX-SCRIPTED:checkout::button::xxx")
    args = ap.parse_args()

    E_exp = flatten(load(args.expected))
    inv = load(args.inventory); E_act = set(inv["elements"].keys())
    vis = load(args.visited); E_vis = set(vis.get("visited_keys", [v["key"] for v in vis.get("events", [])] if False else []))
    # visited 文件可能来自 runner summary（visited_keys）或明细 list
    if "visited_keys" in vis:
        E_vis = set(vis["visited_keys"])
    else:
        E_vis = {v["key"] for v in vis}

    if args.reachable:
        prefixes = tuple(p.strip() + "::" for p in args.reachable.split(",") if p.strip())
        E_reach = {k for k in E_act if k.startswith(prefixes)} | {k for k in E_exp if k.startswith(prefixes)}
    else:
        E_reach = E_act | E_exp

    # 结构一致率：按视图/role/name 对齐
    # 注：静态扫描不一定覆盖所有动态渲染项，这里用 (role+name) 模糊匹配给一个下界
    def role_name(keys): return {tuple(k.split("::")[1:3]) for k in keys}
    rn_exp = role_name(E_exp); rn_act = role_name(E_act)
    S = len(rn_exp & rn_act) / max(1, len(rn_exp | rn_act))

    # 交互覆盖率
    V = len(E_vis & E_reach) / max(1, len(E_reach))

    # 状态覆盖率需要外部输入（脚本无法自动得知 charter 矩阵），先按已访问视图估算
    visited_views = {k.split("::")[0] for k in E_vis}
    reachable_views = {k.split("::")[0] for k in E_reach}
    C_est = len(visited_views & reachable_views) / max(1, len(reachable_views))

    structural_extra = E_act - E_exp
    structural_miss  = E_exp - E_act
    unvisited = sorted(E_reach - E_vis)
    # 应用排除
    excluded = {}; remaining = []
    for k in unvisited:
        hit = False
        for ex in args.exclude:
            if ":" not in ex: continue
            code, pat = ex.split(":", 1)
            if pat.endswith("*") and k.startswith(pat[:-1]): hit = code; break
            if pat == k: hit = code; break
        if hit: excluded[k] = hit
        else: remaining.append(k)

    console_errors = vis.get("console_errors", [])

    cov = {
        "S": round(S, 3), "V": round(V, 3), "C_est": round(C_est, 3),
        "structural_extra": sorted(structural_extra),
        "structural_miss": sorted(structural_miss),
        "unvisited": remaining,
        "excluded": excluded,
        "console_errors": console_errors,
        "threshold_pass": {
            "S": S >= 0.98, "V": V >= 0.95, "console": len(console_errors)==0,
        }
    }
    out_path = pathlib.Path(args.visited).with_name(pathlib.Path(args.visited).stem.replace("_visited","_coverage") + ".json")
    out_path.write_text(json.dumps(cov, ensure_ascii=False, indent=2), encoding="utf-8")

    print("## 覆盖率结果（自动生成）")
    print(f"- 结构一致率 S = {cov['S']:.2%} (阈值 98%) → {'✅' if cov['threshold_pass']['S'] else '❌'}")
    print(f"- 交互覆盖率 V = {cov['V']:.2%} (阈值 95%) → {'✅' if cov['threshold_pass']['V'] else '❌'}")
    print(f"- 视图到达率 C(est) = {cov['C_est']:.2%}（状态维度需人工核对，目标 100%）")
    print(f"- Console errors = {len(console_errors)} → {'✅' if cov['threshold_pass']['console'] else '❌'}")
    print()
    print(f"### 结构不一致（代码 vs 实际渲染，可能是 bug 或动态项）")
    if structural_miss: print("- **代码有但页面未渲染**:"); [print(f"  - {k}") for k in sorted(structural_miss)[:30]]
    if structural_extra: print("- **页面渲染但代码静态未识别**:"); [print(f"  - {k}") for k in sorted(structural_extra)[:30]]
    if not structural_miss and not structural_extra: print("- 无")
    print()
    print(f"### 未交互元素（{len(remaining)}）")
    for k in remaining[:50]: print(f"- [ ] {k}")
    if len(remaining) > 50: print(f"- ...（另 {len(remaining)-50} 项见 coverage.json）")
    print()
    print(f"### 已排除（{len(excluded)}）")
    for k, code in excluded.items(): print(f"- {code}: {k}")
    print()
    print("### Console / 网络错误")
    if not console_errors: print("- 无")
    for e in console_errors[:30]:
        print(f"- [{e.get('type','error')}] {e.get('text') or e.get('url','')}")
    print()
    print(f"详细 JSON: `{out_path}`")

if __name__ == "__main__":
    main()
