---
spec_id: design-hdl-points-001
title: 积分功能技术设计（消费送积分 / 查看积分 / 兑换菜品券 / 结账叠加 / 回退 / 过期）
status: draft
template_id: knowledge/template/技术设计模板.md
schema_version: 1
linked_spec: spec-hdl-points-001
baseline_design: ""
depends_on_designs: []
supersedes_designs: []
created_at: 2026-09-22
updated_at: 2026-09-22
---

# Design: 积分功能技术设计（获取 / 查看 / 兑换 / 叠加 / 回退 / 过期）

> spec 回答 What/Why，design 回答 How。标识符（REQ/FIELD/STATE/NFR）与产品 Spec 完全一致，不重编号。
> 依据：docs/产品Spec.md（spec-hdl-points-001，REQ-001~009 / 数据模型 §6 / OQ-001~005）、docs/需求澄清.md v1.0（R1–R12）、仓库 AGENTS.md 与 knowledge/context。
> spec 与 design 冲突时以 spec 为准；歧义时停下来问 owner。

---

# 1. 总体方案

## 1.1 核心思路

在纯前端内存态 React SPA（`hdl-order-demo`）中新增会话级积分体系，**不引入后端 / 数据库 / 新依赖 / 新视图路由**：

1. **状态层**：扩展 `AppState` 增加 `points: PointsState`（余额 + 明细 + 兑换券），积分 action 并入现有 `orderReducer`（与 `PAY` / `RESET` / 退菜确认天然耦合），保持仓库「单 useReducer 内存态」约定。
2. **计算层**：新增纯函数 `calcCheckout()`（结账金额 + 计分基数 + 入账积分一次性计算，供 CheckoutView 展示与 reducer `PAY` 共用，避免金额口径漂移）与积分辅助函数（余额推导、过期、回退取整），放 `src/lib/`。
3. **配置层**：兑换档位表、有效期、兑换换算基准作为数据常量放 `src/data/points.ts`（对齐 `menu.ts` 静态数据约定，后续评审调整只改一处）。
4. **UI 层**：积分查看 / 明细 / 兑换全部承载于顶栏「会员与排号」弹窗（内部三面板切换，不新增 hash 路由）；结账页新增「可用兑换券」勾选区与支付成功页「获得 N 积分」反馈；DemoConsole 新增「退菜确认」与「积分演示（模拟发放 / 模拟过期）」演示控制。
5. **多语言**：所有新增用户可见文案在 `src/i18n.ts` zh / en 同步新增（REQ-009）。

## 1.2 关键设计结论（含重要发现）

> ⚠️ **可达性发现（技术评审重点）**：默认档位最低 500 积分，而本会话积分仅在**最终一次 `PAY`** 时按「计分基数 = 应付合计（满减后、兑换前）」入账；当前菜单全量菜品单次结账最大计分基数约 366（含售罄品约 334），**单会话内自然消费无法达到 500 积分**，即「兑换 → 结账使用」闭环在纯内存态下不可自然演示（即使分两轮加菜，`PAY` 仍只发生一次、一次性覆盖全部 `orderItems`）。
> 处理：**不改动产品规则**（档位表保持 500/1000/2000、存储保持内存态），按产品 Spec OQ-002/OQ-004 授予技术 Spec 的演示触发路径权限，在 DemoConsole 增加**「模拟发放积分」**（默认 500，演示用）与**「模拟过期」**控制，使兑换与过期规则在同一会话内可演示、可 E2E 验证；同时在 §11 风险与 §14 待确认中显式登记，若评审不接受模拟发放，则需下调档位或引入 localStorage 持久化（产品决策，见 OQ-TECH-001）。

## 1.3 涉及的代码层

| 层 | 目录 | 改动范围 | 关联 REQ / 契约 |
|----|------|----------|------------------|
| 状态契约 | `src/types.ts` | AppState.points、PointEntry/PointsCoupon/PointsState/PointsTier、AppAction 扩展（PAY 载荷 + 4 个新 action） | REQ-001~007、内部 action 契约 |
| 数据常量 | `src/data/points.ts`（新增） | POINTS_TIERS、POINTS_VALID_MONTHS、POINTS_PER_YUAN | REQ-003/006 |
| 计算层 | `src/lib/checkout.ts`（新增）、`src/lib/points.ts`（新增） | calcCheckout（金额 + 计分基数 + 入账积分）、pointsBalance / 回退 / 过期辅助 | REQ-001/003/004/005/006/007 |
| 状态机 | `src/state/orderReducer.ts` | PAY 扩展、REDEEM_POINTS / GRANT_POINTS / APPROVE_CANCEL / EXPIRE_POINTS | REQ-001/003/005/006 |
| UI（会员弹窗） | `src/components/TopBar.tsx`、`src/components/PointsSection.tsx`（新增） | 积分余额卡片、明细面板、兑换面板、可用权益计数 | REQ-002/003/008/009 |
| UI（结账） | `src/components/CheckoutView.tsx` | 兑换券选用与 50% 上限、支付成功页积分反馈 | REQ-001/004/008/009 |
| UI（订单/演示） | `src/components/OrderView.tsx`、`src/components/DemoConsole.tsx` | 退菜已确认态展示；退菜确认 / 模拟发放 / 模拟过期 | REQ-005/006 |
| 装配 | `src/App.tsx` | props 下传与 dispatch 封装 | 全 REQ |
| 文案 | `src/i18n.ts` | `points.*` 新组 + `checkout.*` / `console.*` / `message.*` 扩展（zh/en） | REQ-009 |
| 自动化用例 | `e2e/points.spec.ts`（新增） | REQ-001~009 正反路径 | REQ-001~009、NFR-001/002 |
| 后端 | `server/` | **无**（仓库约定禁止修改，不参与业务链路） | — |
| Proto/DB/配置 | — | **无** | — |

**ADR（设计决策记录）**

- ADR-001（余额口径）：`balance` 显式维护于 reducer（每个 action 原子更新余额与明细，满足 REQ-007.2），并保留纯函数 `pointsBalance(entries)` 作为一致性推导口径（REQ-007.1）供代码级自检与评审引用。选显式而非纯派生，因为过期是时间事件、演示场景下由 action 驱动，显式口径渲染零计算且与产品 Spec「同步更新余额与明细」表述一致。
- ADR-002（状态归属）：积分并入 `orderReducer` 单一 reducer，而非独立 context/reducer。理由：PAY（入账）、RESET（清空）、退菜确认（回退）本就由该 reducer 处理，拆分会引入跨 reducer 同步成本；仓库现有唯一状态入口约定不变。
- ADR-003（PAY 载荷）：`PAY` 由 `{ type: 'PAY' }` 扩展为 `{ type: 'PAY'; couponIds: string[] }`，勾选态为 CheckoutView 本地 `useState`，付款时一次性提交；reducer 以 `paid` 为幂等键，已 paid 直接返回（REQ-001.5）。
- ADR-004（演示触发）：DemoConsole 增加「退菜确认」「模拟发放积分」「模拟过期」——沿用产品 Spec OQ-002/OQ-004 授予技术 Spec 的演示路径权限，且与 DemoConsole 既有「模拟」定位一致（履约推进 / 售罄 / 服务响应）。**不改业务规则、不落盘**。
- ADR-005（金额单一来源）：`calcCheckout(items, coupons, selectedCouponIds)` 是结账金额与计分基数的唯一计算实现，CheckoutView 展示与 reducer `PAY` 同源调用，杜绝「展示应付 ≠ 实付」漂移；金额一律以分（2 位小数）舍入，积分一律整数（`Math.ceil`）。

---

# 2. 文件清单

| # | 文件路径 | 新增/修改 | 职责 | 关联 REQ / 契约 |
|---|----------|-----------|------|------------------|
| F-01 | `src/types.ts` | 修改 | PointsState / PointEntry / PointsCoupon / PointsTier / PointEntryType；AppState.points；AppAction 扩展 | REQ-001~007、契约 C-A1 |
| F-02 | `src/data/points.ts` | 新增 | `POINTS_TIERS`（500=¥5 / 1000=¥10 / 2000=¥20）、`POINTS_VALID_MONTHS=12`、`POINTS_PER_YUAN=100` | REQ-003/006、OQ-001 |
| F-03 | `src/lib/checkout.ts` | 新增 | `calcCheckout()` 纯函数（subtotal/discount/basePayable/couponValue/couponCap/effectiveCoupon/payable/earned） | REQ-001/004/007 |
| F-04 | `src/lib/points.ts` | 新增 | `pointsBalance()`、`pointsForAmount()`（向上取整）、`expiresAtFor()`、过期处理辅助 | REQ-005/006/007 |
| F-05 | `src/state/orderReducer.ts` | 修改 | initialState.points；PAY 扩展（入账 + 券核销 + 幂等）；REDEEM_POINTS / GRANT_POINTS / APPROVE_CANCEL / EXPIRE_POINTS | REQ-001/003/005/006 |
| F-06 | `src/components/PointsSection.tsx` | 新增 | 会员弹窗积分区：余额卡片、积分明细面板、积分兑换面板（三面板切换） | REQ-002/003/008/009 |
| F-07 | `src/components/TopBar.tsx` | 修改 | 接收 points/onRedeem；积分卡片与面板容器；可用权益计数 = 4 + 未使用兑换券数 | REQ-002/003 |
| F-08 | `src/components/CheckoutView.tsx` | 修改 | 可用兑换券勾选区、50% 上限截断与提示、抵扣明细行、支付成功页「获得 N 积分 / 当前积分」；`onPay(couponIds)` | REQ-001/004/008/009 |
| F-09 | `src/components/DemoConsole.tsx` | 修改 | 「退菜确认」区（requested 项 + 确认退菜）、「积分演示」区（模拟发放 / 模拟过期 + 余额展示） | REQ-005/006 |
| F-10 | `src/components/OrderView.tsx` | 修改（小） | `cancelState === 'approved'` 展示「已确认退菜」态（区别于 requested） | REQ-005 |
| F-11 | `src/App.tsx` | 修改 | 传递 points/coupons 与新回调；`onPay(ids)`、`onRedeem(tier)`、`onApproveCancel(uid)`、`onGrantPoints(n)`、`onExpirePoints()` | 全 REQ |
| F-12 | `src/i18n.ts` | 修改 | `points.*` 新组；`checkout.*` / `console.*` / `message.*` 扩展（zh/en 同步） | REQ-009 |
| F-13 | `e2e/points.spec.ts` | 新增 | 积分功能 E2E（REQ-001~009 正反路径） | REQ-001~009、NFR-001 |
| F-14 | 既有 `e2e/view-routing.spec.ts`、`e2e/super-spicy.spec.ts` | 不改（回归验证） | 保证 hash 路由与超级辣流程不回归 | NFR-001 |
| F-15 | `docs/技术Spec.md` | 新增（本文件） | 技术设计 | — |
| F-16 | `docs/任务拆分.md` | 新增 | 前端 / 后端 / 自动化用例任务拆分 | — |

> 变更原则：不修改 `server/`；不引入新依赖 / 新 UI 库 / CSS Modules；不新增视图路由（`ViewName`、`VIEWS`、新 `*View.tsx` 三处均不动）。

---

# 3. 数据模型

> 纯前端内存态，**无数据库变更**（DB 章节不适用）。

## 3.1 内存态字段映射（对应产品 Spec §6.1）

| 对象 | 字段 | 类型 | 说明 | 对应 Spec FIELD | 关联 REQ |
|------|------|------|------|-----------------|----------|
| PointsState | balance | number | 当前可用积分余额（≥0 整数） | POINT-003 | REQ-002/007 |
| PointsState | entries | PointEntry[] | 积分明细流水（追加顺序 = 时间正序，展示时倒序） | POINT-004 | REQ-002 |
| PointsState | coupons | PointsCoupon[] | 积分兑换券列表 | — | REQ-003/004 |
| PointEntry | id | string | 明细唯一 ID（`uid()`） | — | — |
| PointEntry | type | `'earn' \| 'redeem' \| 'refund' \| 'expire'` | 变动类型 | POINT-004 | REQ-002 |
| PointEntry | amount | number | **带符号变动值**：earn 为 +N；redeem / refund / expire 为 −N（展示 ± 直接取符号） | POINT-004 | REQ-002 |
| PointEntry | createdAt | string | 发生时间（沿用现有 `toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' })` 格式约定） | — | REQ-002 |
| PointEntry | note | string | 说明文案（**创建时快照 i18n 解析文本**，与现有 `CALL_SERVICE` 存解析后服务名一致；语言切换后历史记录不回溯翻译） | — | REQ-002 |
| PointEntry | expiresAt | string \| null | 到期时间（ISO 字符串）；earn 必填 = createdAt + 12 个月，其余为 null | POINT-005 | REQ-006 |
| PointEntry | refId? | string \| undefined | 仅 expire 记录引用其来源 earn 明细 id，防止重复过期 | — | REQ-006 |
| PointsCoupon | id | string | 券唯一 ID（`uid()`） | — | — |
| PointsCoupon | value | number | 面值（元，整数） | POINT-006 | REQ-003/004 |
| PointsCoupon | redeemedPoints | number | 兑换消耗积分 | POINT-006 | REQ-003 |
| PointsCoupon | createdAt | string | 兑换时间（locale 时间串） | — | — |
| PointsCoupon | used | boolean | 当餐结账是否已核销（`PAY` 时置 true；会话内单次结账） | — | REQ-004 |
| PointsTier | points / value | number | 兑换档位（points 积分 = value 元面值） | POINT-006 | REQ-003 |

## 3.2 计算规则（对应产品 Spec §6.4，此处定稿实现口径）

- **计分基数（POINT-001）**：`basePayable = subtotal − discount`，其中 `subtotal` 仅统计 `cancelState !== 'approved'` 的 orderItems（与 OrderView 已排除 approved 的口径对齐，避免结账金额 ≠ 订单页合计）；`discount = subtotal >= 100 ? 30 : 0`（沿用现有规则）。
- **入账积分（POINT-002）**：`earned = Math.ceil(basePayable)`；`basePayable <= 0` 时不入账（REQ-001.3，当前数据不可达，仅防御）。
- **兑换（POINT-006）**：档位常量 `POINTS_TIERS`；`券面值 = 档位积分 / POINTS_PER_YUAN`（100 积分 = 1 元，换算基准）；兑换校验 `balance >= tier.points`。
- **结账叠加（POINT-007/008）**：`couponValue = Σ 勾选且未使用券.value`；`couponCap = basePayable × 0.5`；`effectiveCoupon = min(couponValue, couponCap)`（2 位小数舍入）；`payable = basePayable − effectiveCoupon`（≥0，不找零、不产生负应付）；**计分基数始终为兑换前 `basePayable`，不受券抵扣影响**（REQ-004.5/REQ-001.1）。
- **回退（REQ-005）**：`refundPoints = Math.ceil(item.price × item.quantity)`（与入账取整一致，向上取整；当前单价为整数故等于金额整数）；回退后 `balance = max(0, balance − refundPoints)`（REQ-005.2）。
- **过期（REQ-006）**：`expiresAt = 入账时间 + POINTS_VALID_MONTHS 个月`；`EXPIRE_POINTS`（演示「模拟过期」）将所有未被 expire 记录引用的 earn 项标记过期：余额扣减、追加 `expire` 明细（amount = −earn.amount、refId = earn.id）。
- **一致性（REQ-007）**：`pointsBalance(entries) = Σ(earn) − Σ(redeem) − Σ(refund) − Σ(expire)`（其中 earn 仅统计未过期项）；reducer 维护的 `balance` 恒等于该推导值（代码级自检口径）。

> **浮点说明**：金额一律 `Math.round(x * 100) / 100` 以分为单位舍入后再展示（沿用 `money()` 的 `toFixed(2)` 输出）；积分恒为整数。当前菜品单价与数量均为整数，`basePayable` 恒为整数，`Math.ceil` 在实际数据下为恒等操作，仍按 Spec 实现以保持规则完整性与未来小数价格扩展（如半份价）。

---

# 4. 接口契约

> 本需求无对外 API / SDK / Webhook / CLI（纯前端内存态，仓库约定禁止后端调用）。「接口契约」指应用内部三类契约：reducer Action、组件 Props、i18n Key。

## 4.1 reducer Action 契约（`src/types.ts` 的 AppAction 扩展）

| Action | 载荷 | 前置条件 | 效果 | 失败处理 | 关联 REQ |
|--------|------|----------|------|----------|----------|
| `PAY` | `{ couponIds: string[] }` | 未 paid | 核销所选券（used=true）、按 `calcCheckout` 入账积分（earn 明细 + balance）、`paid=true` | 已 paid：原样返回（幂等，REQ-001.5） | REQ-001/004 |
| `REDEEM_POINTS` | `{ points: number; value: number }` | `balance >= points` 且档位在 `POINTS_TIERS` | 扣减积分、追加 `redeem` 明细（−points）、生成未使用券 | 余额不足 / 非法档位：原样返回（UI 已禁用，reducer 兜底） | REQ-003 |
| `GRANT_POINTS` | `{ points: number }` | 演示控制台 | 追加 `earn` 明细（note=演示发放）并增加余额 | points ≤ 0：忽略 | REQ-003（演示可达性） |
| `APPROVE_CANCEL` | `{ uid: string }` | 订单项存在且非 approved | 置 `cancelState='approved'`；若 `paid` 按该项金额回退积分（`refund` 明细 + 余额扣减，0 截断） | 项不存在 / 已 approved：原样返回 | REQ-005 |
| `EXPIRE_POINTS` | — | 演示控制台 | 全部未过期 earn 项过期（`expire` 明细 + 余额扣减） | 无 earn 项：原样返回 | REQ-006 |
| `RESET` | — | 任意 | 恢复 `initialState`（points 清空） | — | 兼容既有 |

> 实现位置：`src/state/orderReducer.ts`。`SET_STAGE` / `REQUEST_CANCEL` 等既有 action 不改变（`REQUEST_CANCEL` 仅置 requested，审批走 `APPROVE_CANCEL`）。

## 4.2 组件 Props 契约

| 组件 | 新增 Props | 说明 |
|------|-----------|------|
| `CheckoutView` | `points: PointsState`、`onPay: (couponIds: string[]) => void` | paid 分支读 `points` 展示「获得 N 积分 / 当前积分」；按钮提交勾选券 id |
| `TopBar` | `points: PointsState`、`onRedeem: (tier: PointsTier) => void` | 积分卡片 / 明细 / 兑换 |
| `PointsSection`（新） | `points: PointsState`、`onRedeem: (tier: PointsTier) => void` | 三面板内容组件，由 TopBar 弹窗内容区挂载 |
| `DemoConsole` | `items: OrderItem[]`、`points: PointsState`、`onApproveCancel: (uid: string) => void`、`onGrantPoints: (n: number) => void`、`onExpirePoints: () => void` | 退菜确认 + 积分演示 |
| `OrderView` | 不变（内部按 `cancelState` 分支文案） | — |

## 4.3 i18n Key 契约（zh / en 同步新增，完整 key 清单见 §F-12 实现）

`points.*`：`balance`、`ledger`、`redeem`、`current`、`earned`、`empty_ledger`、`empty_redeem`、`insufficient`、`tier`、`redeem_btn`、`back`、`type_earn/type_redeem/type_refund/type_expire`、`expires`、`earn_note`、`redeem_note`、`refund_note`、`expire_note`、`grant_note`。
`checkout.*` 扩展：`available_coupons`、`coupon_deduction`、`coupon_limit`、`no_coupons`、`earned_line`、`points_balance`。
`console.*` 扩展：`refund_title`、`refund_empty`、`refund_confirm`、`points_title`、`points_grant_btn`、`points_expire_btn`、`points_grant_placeholder`、`balance_label`。
`message.*` 扩展：`points_earned`、`redeem_success`、`refund_points`、`cancel_approved`、`points_expired`、`points_granted`、`coupon_limit`。

---

# 5. 前端状态编排

> 无后端服务编排；以下为纯前端内存态的状态流转（对应产品 Spec §6.3）。

**主流程：消费送积分**
1. CheckoutView 本地勾选兑换券（`selectedCouponIds`）→ `calcCheckout` 实时重算应付并展示（含 50% 上限截断提示）。
2. 点击「确认支付」→ `dispatch({ type:'PAY', couponIds })` → reducer 计算入账、核销券、追加 earn 明细 → paid 分支展示「获得 N 积分 / 当前积分」。

**主流程：查看积分**
1. 顶栏会员入口 → 弹窗主面板显示余额卡片 → 「积分明细」面板按时间倒序渲染 entries（类型徽标 / ±变动值 / 时间 / 说明 / 到期时间）。
2. 明细为空 → 空态「暂无积分记录」。

**主流程：兑换 + 结账叠加**
1. 弹窗「积分兑换」面板展示档位与余额 → 兑换校验（`balance >= tier.points`，不足禁用并提示「积分不足」）→ `REDEEM_POINTS` → 扣减 + redeem 明细 + 新券。
2. 结账页券选用区列出未使用券 → 勾选 → 应付重算（REQ-004）→ `PAY` 核销。

**分支：回退 / 过期 / 异常**
1. 支付后 OrderView 发起退菜（REQUEST_CANCEL → requested）→ DemoConsole「退菜确认」→ `APPROVE_CANCEL` → approved + 回退积分（未支付仅 approved 不回退）。
2. DemoConsole「模拟过期」→ `EXPIRE_POINTS` → 过期明细 + 余额剔除，兑换校验失效。
3. 各空态 / 上限 / 不足提示按 REQ-008 覆盖；`RESET` 清空全部积分态。

---

# 6. 状态机（action 流转）

| ACTION | 前置状态 | 目标状态 | 实现位置 | 关联 REQ |
|--------|----------|----------|----------|----------|
| PAY | 未 paid | paid + 积分入账 + 券核销 | `orderReducer.ts` | REQ-001/004 |
| REDEEM_POINTS | 余额 ≥ 档位 | 余额扣减 + 新券 + redeem 明细 | `orderReducer.ts` | REQ-003 |
| GRANT_POINTS | 任意（演示） | 余额增加 + earn 明细（note=演示发放） | `orderReducer.ts` | 演示可达性 |
| APPROVE_CANCEL | 项 requested | approved（paid 时同时回退积分） | `orderReducer.ts` | REQ-005 |
| EXPIRE_POINTS | 有未过期 earn | 全部过期 + expire 明细 + 余额剔除 | `orderReducer.ts` | REQ-006 |
| RESET | 任意 | 初始态（points 清空） | `orderReducer.ts` | 兼容既有 |

---

# 7. 异步任务

不涉及（无定时器 / 无后台任务 / 无轮询）。过期规则由「模拟过期」演示控制驱动，不设真实定时器（演示会话远短于 12 个月，产品 Spec OQ-004 已确认）。

---

# 8. 外部依赖

无新增依赖。复用现有：`react-i18next`（文案）、`lucide-react`（图标）、CVA `Button`、Radix `Dialog`、`uid()` / `money()`（`src/lib/utils.ts`）、Tailwind 色板（rice/chili/amber/charcoal）。

---

# 9. 配置与 Feature Gate

| 配置键 / 常量 | 默认值 | 用途 |
|---------------|--------|------|
| `POINTS_TIERS`（`src/data/points.ts`） | `[{points:500,value:5},{points:1000,value:10},{points:2000,value:20}]` | 兑换档位表（OQ-001，评审可改，仅一处） |
| `POINTS_PER_YUAN` | `100` | 100 积分 = 1 元（R5 换算基准） |
| `POINTS_VALID_MONTHS` | `12` | 积分有效期（R7） |
| 结账满减 | 沿用现有 `subtotal >= 100 → 30` | 不新增配置 |
| 50% 上限 | 沿用产品 Spec 常量口径（`couponCap = basePayable * 0.5`） | 不新增配置 |

不引入 localStorage 新 key（保持内存态，OQ-005 默认；如评审改选持久化，按 AGENTS.md try/catch 降级约定实现并同步更新本设计 §6 生命周期说明）。

---

# 10. 上线策略（部署影响）

| 步骤 | 动作 | 备注 |
|------|------|------|
| 1 | 前端实现 + 本地验证（build / lint / tsc / playwright） | 本节点仅文档，代码验证由下游节点执行 |
| 2 | 合并工作分支 `feat/points-feature-nzt7` → `main` | push main 触发 `.github/workflows/deploy-pages.yml`（npm ci + build + 上传 dist） |
| 3 | GitHub Pages 静态发布 | `base './'` + hash 路由，子路径部署不变 |
| 4 | E2E / 人工走查 | 无 CI E2E，本地验证 + Review 节点复核 |

**回滚预案**：静态站点，回滚 = 回退 `main` 分支上一个部署 commit 即可；无 DB / 配置 / 服务端变更，无数据迁移风险。
**影响面**：不修改 `server/`；不新增环境变量 / Secret / 构建步骤；`dist/` 产物大小仅增加少量 JS。

---

# 11. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| **兑换可达性**（OQ-TECH-001）：默认档位 500 起，单会话自然消费最大基数约 366，兑换与「结账使用」闭环无法自然演示 | 验收「用户可使用积分」不可演示 | 不修改产品规则；DemoConsole 提供「模拟发放积分」（默认 500，明确演示语义）；已在 §14 登记待确认，评审不接受则需产品决策（下调档位 / 持久化） |
| 回退取整超发：每项 `ceil(金额)` 回退之和可能超过总入账（如 128 入账、三项各 42/48/68 回退） | 余额负数 | `max(0, balance − refund)` 0 截断（REQ-005.2），并提示；E2E 覆盖多笔回退归零场景 |
| 金额浮点精度（50% 上限对奇数基数产生 .5 应付） | 展示金额误差 | 计算以分舍入 `Math.round(x*100)/100`，展示沿用 `money()`；E2E 断言精确文案 |
| 勾选券金额超过上限时的口径歧义（部分使用 vs 仅截断） | 用户困惑 | 按产品 Spec OQ-003 默认：多选 + 上限截断实际抵扣 + 提示超出部分不可用 + 不找零 |
| 既有 E2E 回归（TopBar / CheckoutView 结构变化） | view-routing / super-spicy 用例可能被文案或 DOM 变化影响 | 改动保持最小、不加路由、不删既有文案；E2E 节点跑全量回归 |
| i18n key 缺失（zh/en 不同步） | 页面出现 key 原文 | 按 REQ-009 双向同步；E2E 覆盖 EN 切换断言 |
| 明细 note 为创建时快照（语言切换不回翻历史） | 历史明细语言不随切换 | 与现有 CALL_SERVICE 行为一致，属既有约定，文档明示 |
| 重复兑换 / 重复核销（内存态无并发） | 状态错乱 | reducer 以余额与 `used` 状态实时校验兜底（REQ-003.3 / REQ-001.5） |

---

# 12. 测试要点

> 测试以 E2E（Playwright）为主，仓库无单测框架；用例命名按 docs/agent-testing.md（`REQ-xxx`、describe 按功能域、单用例单验收点、正反路径、用例可乱序）。E2E 数据准备推荐：DemoConsole「模拟发放积分」做确定性种子（自然多轮加菜亦可达到 500，但路径冗长）。

| 场景 | 方法 | 关联 REQ |
|------|------|----------|
| 支付后按「basePayable × 1、向上取整」入账，支付成功页展示获得积分与余额 | E2E（如 p1+p3+p4=¥158 → base 128 → 128 积分） | REQ-001 |
| 已 paid 重复进入结账不重复入账（幂等） | E2E：明细条数不变、余额不变 | REQ-001.5 |
| 会员弹窗展示余额；明细倒序且字段齐全（类型/时间/±变动值/说明/到期时间） | E2E | REQ-002 |
| 明细空态「暂无积分记录」 | E2E（新会话） | REQ-002/008 |
| 兑换成功：种子 600 → 兑换 500 → 余额 100、券 +1、明细「使用 −500」 | E2E（经 DemoConsole 种子） | REQ-003 |
| 积分不足 / 空余额：兑换禁用并提示、空态 | E2E | REQ-003/008 |
| 结账勾选兑换券应付重算（小计 − 满减 − 券价值） | E2E（如 base 128 + ¥10 券 → 应付 118） | REQ-004 |
| 超过 50% 上限截断并提示、不找零、应付不为负（如 base 80 + 券 50 → 实际抵扣 40 → 应付 40） | E2E | REQ-004/008 |
| 券抵扣不影响本次入账基数（抵扣后入账仍按 base 128） | E2E | REQ-004.5 |
| 支付后退菜确认 → 回退积分 + 「回退」明细 | E2E（如 128 − 42 → 86） | REQ-005 |
| 未支付退菜确认 → 不回退积分、仅 approved | E2E | REQ-005.3 |
| 多笔回退超过余额 → 余额 0 不为负（0 截断） | E2E（三笔回退累计 > 入账） | REQ-005.2 |
| earn 明细展示到期时间（入账 + 12 个月） | E2E | REQ-006.1 |
| 模拟过期 → 余额剔除、过期明细、兑换不可用 | E2E（DemoConsole「模拟过期」） | REQ-006 |
| 任意混合操作后展示余额 = 明细 ± 合计 | E2E（读取展示值求和断言） | REQ-007 |
| 语言切换 EN：积分相关文案英文且无缺失 key | E2E | REQ-009 |
| 既有回归：view-routing / super-spicy 全绿；build / lint / tsc 通过 | `npx playwright test`、`npm run build`、`npm run lint`、`npx tsc -b --noEmit` | NFR-001/002 |

---

# 13. 任务拆分指引

见 `docs/任务拆分.md`（前端 / 后端 / 自动化用例三组，按依赖排序）。

---

# 14. 评审要点与 Open Questions

| ID | 问题 | 影响 | 建议默认值 | 负责人 |
|----|------|------|------------|--------|
| OQ-TECH-001 | **兑换演示可达性**：默认档位 500 起 > 单会话自然入账上限（约 366），「兑换 → 结账使用」闭环在纯内存态下无法自然演示 | 验收可演示性 | DemoConsole「模拟发放积分」（默认 500，演示语义）；如不接受模拟，需产品决策下调档位或引入 localStorage 持久化 | PM / RD 评审 |
| OQ-TECH-002 | 回退取整与触发路径（沿用产品 Spec OQ-002 默认） | 回退可演示性 | 触发 = DemoConsole「退菜确认」；取整 = 每项 `ceil(金额)`；余额 0 截断 | PM / RD |
| OQ-TECH-003 | 券多选与 50% 上限截断细节（沿用 OQ-003 默认） | 结账交互 | 多选、按上限截断实际抵扣、提示超出部分、不找零 | PM / RD |
| OQ-TECH-004 | 过期演示方式（沿用 OQ-004 默认） | 过期可验证性 | DemoConsole「模拟过期」 | PM / RD |
| OQ-TECH-005 | 存储形态（沿用 OQ-005 默认） | 演示连续性 | 内存态、不新增 localStorage；如需持久化按 try/catch 降级约定 | RD |
| OQ-TECH-006 | 档位表数值定稿（沿用 OQ-001 默认 500/1000/2000） | 兑换区展示 | 常量化于 `src/data/points.ts`，评审改动仅一处 | PM |

**本节点文档级自检结论**：改动面与产品 Spec §2/§6 一致（纯前端内存态）；REQ-001~009 均有实现位置与 E2E 覆盖；接口契约（action/props/i18n）完整；未修改 `server/`、无新增依赖、无路由变更；5 项产品 Spec 待确认项均给出技术默认值并登记（OQ-TECH-001~006）。代码级验证（build/lint/tsc/playwright）由下游开发节点执行。
