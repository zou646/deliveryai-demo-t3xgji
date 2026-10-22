# 新页面探索性测试解决方案（ET Solution Pack v1.1）

> 目标：在脚本化 E2E 之外，提供**可复用、可量化、可归档**的结构化探索性测试方案。只提供 S+（默认三角色）和 X（穷尽红蓝对抗）两个模式，明确 Planner/Executor/Monitor/Reviewer 四角色边界，确保"覆盖所有功能"可度量、可追溯。

## 模式

| 模式 | 角色 | 适用 | 默认时间 | 覆盖率阈值 |
| --- | --- | --- | --- | --- |
| **S+（默认）** | Planner + Executor(A) + Monitor + Reviewer | 新功能/常规发布兜底 | Executor 25 min | S≥0.98 / V≥0.95 / C=1.00 / console errors=0 |
| **X（穷尽）** | Planner + 2 Executor(A/B 红蓝) + 2 Monitor + Reviewer | 核心链路/资金积分/大版本/事故复盘 | A/B 各 20 min | S≥0.98 / V≥0.98 / C=1.00 / console errors=0 |

Monitor 全程只读并行观察，不点击、不改 charter、不判 bug，只做 6 件机械事：
1. 交互日志守门；2. Console/Error 实时告警；3. 视图/状态门禁；
4. 覆盖率增量守护；5. Charter 遵守度打标；6. 每步自动截图。

## 目录结构

```
et-solution/
├── README.md                    # 本文档
├── skill/SKILL.md               # Agent Skill（模式/角色边界/流程/纪律/完成条件）
├── rules/
│   ├── coverage.md              # S/V/C 覆盖率指标、阈值、排除码、视图×状态矩阵
│   └── risks.md                 # A–I 9 类反模式破坏路径清单
├── templates/
│   ├── charter.md               # Charter 人读模板
│   ├── charter.json             # Charter 机读 schema（Monitor 用它对账）
│   └── session_report.md        # 会话报告模板
├── scripts/
│   ├── README.md                # 脚本说明
│   ├── et_static_expected.py    # TSX → E_expected
│   ├── et_enumerate.py          # 打开站点 → E_actual inventory
│   ├── et_runner.py             # 启动浏览器，注入交互/console 监听，自由探索
│   ├── et_monitor.py            # Monitor 只读观察进程，实时告警+自动截图+落盘
│   ├── et_diff.py               # 覆盖率对账 + coverage.{json,md}
│   └── et_run_all.sh            # 一键入口：static → enumerate → charter(待填) → runner+monitor → diff
└── reports/                     # 执行产物
```

## 核心保障机制

1. **Charter 先冻结**：Planner 出 charter.json 后不改，Monitor 只打 `charter-issue` 标签，事后 Reviewer 裁定。
2. **角色严格隔离**：Executor 不读源码、Monitor 不点击页面、Planner 不连浏览器——避免自己出题自己答。
3. **三层元素集合 + diff**：E_expected/E_actual/E_visited 对比暴露结构 bug 与漏点。
4. **视图×状态矩阵 C=100%**：charter 里列笛卡尔积，结会时逐项打勾。
5. **Monitor 实时纠偏**：每步对账 expected vs 实际，漏点/异常状态立即 alert，不把问题拖到报告阶段。
6. **反模式清单强制扫**：A 重复/B 导航/C 刷新/D 语言/E 极端/F a11y/G 视觉/H console/I 架构边界。
7. **阈值门禁**：不达标必须补探或说明原因。
8. **X 模式双盲红蓝**：A/B 独立跑，交集盲区反哺 Planner 风险库。
9. **证据反哺 E2E**：稳定复现 bug 必须给 Playwright 片段。
10. **Console 零容忍**：非白名单错误一律登记。

## 快速使用（S+ 模式）

```bash
cd scripts
./et_run_all.sh https://<url> <repo_root> et-YYYYMMDD-<feature> headful
# 首次会生成 charter.json 模板，编辑 scope/steps/thresholds 后再跑一次
# Executor 期间 Monitor 并行记录 alerts/console/screenshots；Ctrl+C 结束
# 产物落在 reports/<sid>/：expected/inventory/<sid>_a_visited/_console/_summary/_alerts/_monitor/coverage + screenshots
```

X 模式加 `--x`：
```bash
./et_run_all.sh https://<url> <repo_root> et-YYYYMMDD-<feature>-X headful --x
```

## 完成条件

- Charter 已冻结，四（X 模式五）个角色职责分明；
- 覆盖率 S/V/C 达标，未覆盖项全部带排除码（EX-OUT-SCOPE/EX-SCRIPTED/EX-DEPRECATED/EX-PERMISSION/EX-KNOWN）；
- Bug 清单带证据、已定级（S0/S1/S2/S3）；
- 建议补入 E2E 的 Playwright 片段已给出；
- Session 报告 bundle 已上传共享产物。

## 与脚本化 E2E 的关系

- 脚本化 E2E 守住已确认验收标准（REQ-001~009），跑在 CI/集成测试节点；
- ET 是兜底，建议在"联调部署后、集成测试前"与"集成测试全绿后、发布前"各跑 1 轮；
- ET 发现的稳定 bug → 反哺脚本化 E2E；S2/S3 体验问题记入 backlog；S0/S1 阻塞发布。
