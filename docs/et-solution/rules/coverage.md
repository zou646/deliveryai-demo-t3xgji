# 覆盖率规则与计算方式

目标：**量化**"是否覆盖完系统页面上所有功能"，不靠感觉。

## 1. 三层元素集合

每次会话生成三个集合，元素 key 统一为 `{view}::{role}::{name}`：

- **E_expected（期望元素集合）**：来自代码静态分析
  - 路由/视图：从 `src/App.tsx` ViewName 枚举、`useViewRoute` 的 VIEWS 配置提取所有 hash 路由；
  - 组件：扫描 `src/components/*.tsx` 中有 `role=`/`getByRole` 可对应语义的按钮/链接/tab/输入/对话框；
  - 显式标记：`/* et:element {role} {name} on {view} */` 注释可用于脚本无法静态识别的元素。
- **E_actual（实际可交互元素集合）**：运行时枚举
  - 在每个视图/每个状态下，用 Playwright `page.getByRole('button|link|textbox|...')` 抓所有可交互元素的 role + 可访问名；
  - 扫描所有 `a[href]`、`button`、`input/select/textarea`、`[tabindex]`、`[role]`。
- **E_visited（会话中实际触发的元素）**：运行时日志
  - 用 Playwright 的 `page.on('dialog')` 以及在所有探索操作（click/fill/check/select/press）中记录触发的元素 key；
  - 脚本通过 monkey-patch `Locator.click/fill/...` 自动收集。

## 2. 三个核心指标

- **结构一致率 S = |E_expected ∩ E_actual| / |E_expected ∪ E_actual|**
  - S < 1 说明页面上有"代码里有但渲染出来少了"或"渲染出来但代码里没声明"的元素，可能是 bug 或未注册组件。
- **交互覆盖率 V = |E_visited| / |E_reachable|**
  - E_reachable 是本次 charter 范围内声明可达的元素子集（排除登录态/权限外/脚本已守/不在范围内等显式排除项）。
  - V ≥ 95% 才能结会；未命中的 5% 必须在报告里逐条例明原因。
- **状态覆盖率 C = |实际打到的(view,state)组合| / |charter 声明的(view,state)矩阵|**
  - 默认要求 C = 100%。

## 3. 视图×状态矩阵

每个 charter 必须列视图与状态的笛卡尔积，单元格填 pass/fail/bug_id/na：

- 视图（示例）：home / welcome / menu / order / checkout / member-dialog.main / member-dialog.ledger / member-dialog.redeem / demo-console
- 状态维度（示例）：
  - 语言：zh / en
  - 视口：desktop(1280×720) / mobile(390×844)
  - 积分余额：0 / <500 / 500 / 600-999 / 1000+ / 5000+
  - 订单：空 / 有商品未提交 / 已提交未支付 / 已支付 / 含退菜申请
  - 兑换券：无 / 有未使用 / 有已使用

## 4. 允许排除（需在报告中写明 code）

| 排除码 | 含义 |
| --- | --- |
| EX-OUT-SCOPE | 超出本次 charter 范围（需写明属于哪个 charter） |
| EX-SCRIPTED | 已由脚本化 E2E 守护，给出 spec 文件名+用例名 |
| EX-DEPRECATED | 代码遗留、不可达路径（给出源码位置） |
| EX-PERMISSION | 需要特殊权限/登录态/后端数据，ET 环境无法构造 |
| EX-KNOWN | 已知非阻塞遗留（给出 issue/遗留单号） |

未使用排除码、又未出现在 E_visited 中的元素，一律记为未覆盖，**必须补探**，不得结会。

## 5. 阈值与门禁

- S ≥ 0.98（结构一致性，允许 2% 动态项偏差如 toast）
- V ≥ 0.95（S+ 模式交互覆盖率）/ V ≥ 0.98（X 模式）
- C = 1.00（状态覆盖率）
- Console errors = 0（除 EX-KNOWN 白名单外）

任一阈值不达标且无合理解释 → 会话结论 "未通过 / 需补探"，不得输出"通过"。

## 6. 反模式检测（独立于覆盖率）

即使覆盖率 100%，也必须额外检查 `rules/risks.md` 列出的反模式；这些是"点了但组合不对"才出的 bug。
