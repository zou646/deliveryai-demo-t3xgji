---
name: exploratory-testing
description: 结构化探索性测试（ET）。在脚本化 E2E 之外，按 Charter 在时间盒内自由探索、发现脚本未覆盖的问题，并反哺回归用例。提供 S+（默认，Planner+Executor+Monitor 三角色）和 X（穷尽，双 Executor 红蓝对抗）两个模式。
---

# Exploratory Testing（S+ / X 两个模式）

## 何时触发
- 新页面/新功能完成脚本化 E2E 且全绿，发布前兜底；
- 用户要求"探索/自由点/兜底查 bug/ET/exploratory"；
- 脚本报告里有 flaky/未覆盖风险点（不可达分支、非阻塞遗留、架构约束）需要补验；
- 需要检查 console error、视觉、a11y、深链接、回退、刷新、极端数据等脚本没覆盖的路径。
不替代：脚本化 E2E（明确 REQ 项）、性能/安全/a11y 合规专项、静态护栏（tsc/lint/build）。

## 两种模式

### 模式 S+（Standard + Monitor）——默认模式
三角色、单 Executor、Monitor 并行只读观察：
- Planner（不连浏览器、读源码/Spec/E2E）→ 出 `charter.json` + `charter.md`；
- Executor（连浏览器、不读源码）→ 按 charter 操作、记录 bug；
- Monitor（连浏览器**只读**、不读源码）→ 实时订阅 click/console/error，对比 charter 预期，偏差异常实时告警；
- Reviewer（主 Agent）→ 事后对账覆盖率、定级 bug、生成报告、反哺 E2E。
适合：新功能首次上线、中风险变更、常规发布前兜底。

### 模式 X（eXhaustive / 红蓝对抗）
在 S+ 基础上增加一个独立 Executor 做红蓝对抗：
- Executor-A：按 charter 走主路径+反模式；
- Executor-B：只做"破坏/奇怪路径"（charter.B 子章程），不知 A 的存在，不读 A 的结论；
- Monitor 同时观察两个会话（两个 BrowserContext，分别打 tag session=a/b）；
- Reviewer 合并 A/B 两个 bug 清单去重，计算两份覆盖率取并集，"两个执行者都没点到"的元素必须给出排除码。
适合：核心支付/积分/账户等高风险链路、大版本发布、线上事故后复盘兜底。

## 三角色的严格边界

| 角色 | 连浏览器 | 读源码 | 可点击页面 | 可改 charter | 可判 bug |
| --- | --- | --- | --- | --- | --- |
| Planner | ❌ | ✅ | ❌ | ✅（执行前冻结） | ❌ |
| Executor | ✅ | ❌ | ✅ | ❌ | ✅（记录候选，初判严重度） |
| Monitor | ✅（只读） | ❌ | ❌ | ❌（只打 charter-issue 标签） | ❌（只记异常、不判严重度） |
| Reviewer | ❌ | ✅ | ❌ | ❌ | ✅（最终定级、决定通过/不通过） |

Monitor 的 6 项职责（全机械、零主观）：
1. **交互日志守门**：每步对比预期元素集合 vs visited，漏点立即 alert；
2. **Console/Error 实时告警**：error/pageerror/unhandledrejection/requestfailed 非白名单即记录；
3. **视图/状态门禁**：每步校验 hash/Dialog heading/余额/券数等 DOM 值是否符合 charter 预期；
4. **覆盖率增量守护**：visited 长时间不增长/结束时 V<阈值 强制补探；
5. **Charter 遵守度**：超范围操作打 off-chapter 标签；
6. **证据完整度**：每步自动截图 + 日志，bug 缺截图/缺 console 提示补。

Monitor 严禁：点击页面、改 charter、主观评价体验/视觉、判断 bug。

## 执行原则
1. **Charter 先于行动，冻结后不改**：Planner 出完 charter 即封存，Monitor 发现设计问题只打 `charter-issue`，事后 Reviewer 裁定。
2. **结构化覆盖**：视图×状态矩阵 + 可交互元素清单 + 风险反模式清单三轨并行，覆盖率必须有数据。
3. **Timebox 严格**：S+ 默认单 Executor 25 分钟；X 默认 A/B 各 20 分钟。
4. **Bug or It Didn't Happen**：每个发现带复现步骤、截图、console、严重度、预期 vs 实际。
5. **Console 零容忍**：非 EX-KNOWN 的 error/pageerror/4xx-5xx 一律登记。
6. **不改代码**：ET 只发现记录；修复回开发/脚本流程，避免边探边改污染证据。
7. **问题反哺脚本**：稳定复现的 bug 必须给 Playwright 片段，补入 e2e 回归集。
8. **只读探索**：生产/预发不做不可逆操作。

## 标准流程

### 阶段 0 准备
- 读 AGENTS.md / agent-testing.md / agent-release.md / Spec / E2E 脚本；
- 打开被测 URL；
- 选模式（默认 S+；涉及资金/积分/账户核心链路用 X）。

### 阶段 1 Planner（5–10 min）
输入：Spec + E2E 脚本 + rules/coverage.md + rules/risks.md + 已知遗留清单
输出：
- `charter.json`（机读：target/scope/views/state_matrix/steps[每步 action+expected]/exclusions/known_console_allowlist/risks_to_cover/thresholds）；
- `charter.md`（人读摘要）。
模板：`templates/charter.json` + `templates/charter.md`。
Charter 门禁（Reviewer 做一次快速审阅，不合格打回重写）：
- 视图×状态矩阵笛卡尔积明确；
- A/B/C/D/E/H 类反模式至少覆盖 5 类；
- 每步必须有具体预期（view/elements/state/allowlist）；
- 排除项必须带排除码（EX-OUT-SCOPE/EX-SCRIPTED/EX-DEPRECATED/EX-PERMISSION/EX-KNOWN）。

### 阶段 2 Executor + Monitor 并行（timebox）
- Executor 启动 `scripts/et_runner.py` 或使用浏览器工具按 charter.json 操作，每步完成调用 `__et_step_done(stepId)` 让 Monitor 对账；
- Monitor 启动 `scripts/et_monitor.py` 以只读方式 attach 到同一个 BrowserContext，订阅 click/console/error，每步对比 expected，写出 `*_alerts.jsonl`；
- Executor 遇到 alert 必须回应：补做、记录为 charter-issue、或记录为 bug；
- 全部 step 完成后 Monitor 给出最终覆盖率预检，V<阈值不得结束。

X 模式下两个 Executor 各自独立 BrowserContext，Monitor 同时 attach 两个（tag session=a/b），互不干扰。

### 阶段 3 Reviewer 出报告（5–10 min）
- 跑 `scripts/et_diff.py` 计算 S/V/C，合并 visited/console/bug；
- X 模式下合并 A/B 两份去重，标记"双方都漏的元素"（盲区分析）；
- 按 `templates/session_report.md` 生成会话报告；
- 定级 bug：S0 阻塞 / S1 严重 / S2 一般 / S3 建议；
- 对 EX-KNOWN / EX-SCRIPTED / EX-OUT-SCOPE 等排除项复核是否合理；
- 给出结论：通过 / 有条件通过 / 不通过 / 阻塞；
- 用 `agentnative artifacts push bundle` 上传会话报告目录（含 inventory/visited/console/coverage/截图/bug 清单/建议 E2E 片段）。

## 覆盖保障

1. **三层元素集合 + diff**：E_expected（静态扫描）× E_actual（运行时枚举）× E_visited（交互日志）；
2. **视图×状态矩阵**：charter 里笛卡尔积，C=100% 才能结会；
3. **交互自动监听**：addInitScript 注入监听，所有 click/change/keydown/fill 自动落盘；
4. **Console/网络零容忍**：全程记录 error/pageerror/requestfailed；
5. **Monitor 实时纠偏**：每步对账，不把偏差拖到报告阶段才发现；
6. **阈值门禁**：S≥0.98、V≥0.95（X 模式 ≥0.98）、C=1.00、非白 console errors=0；
7. **排除码机制**：未覆盖元素必须带排除码，否则必须补探；
8. **反模式强制扫**：A–I 类 9 组破坏路径逐项打勾（X 模式需全部覆盖）；
9. **X 模式双盲**：两 Executor 独立跑，盲区取交集反哺 Planner 风险库；
10. **反哺脚本**：稳定 bug 给 Playwright 片段，永久守。

## 严重度
- S0 阻塞：主流程不通/数据损坏/白屏/致命 console error → 阻塞发布；
- S1 严重：核心功能异常/数据错 >10% 场景 → 一般阻塞，产品决策；
- S2 一般：单点 UI/文案/交互，不影响主流程 → 不阻塞，排期；
- S3 建议：体验优化/一致性 → 不阻塞。

## 不要做
- 不做生产破坏性操作；
- 不用 ET 替代脚本 E2E；
- ET 过程中不改代码；
- Executor 不读源码（避免按实现"做题"）；
- Monitor 不点击页面、不改 charter、不判 bug；
- 不凭感觉说覆盖了，覆盖率必须有 et_diff 输出数据；
- 不漏 console error（已知第三方也要 EX-KNOWN 登记）。

## 完成条件
- Charter 已冻结，Planner/Executor/Monitor/Reviewer 四角色职责分明（X 模式两 Executor 并行）；
- 覆盖率报告生成：S/V/C 达标，未覆盖项全部带排除码；
- Bug 清单带证据、已定级；
- 建议补入 E2E 的 Playwright 片段已给；
- Session 报告 bundle 已上传共享，最终回复给出 artifact_id 与入口。
