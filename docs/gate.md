---
spec_id: gate-hdl-points-001
title: 积分功能产品 Spec 质量卡点
status: draft
template_id: knowledge/template/需求质量卡点模板.md
schema_version: 1
created_at: 2026-09-22
updated_at: 2026-09-22
---

# Gate: 积分功能产品 Spec（消费送积分 / 查看积分 / 兑换菜品券）

## Summary

积分功能产品 Spec（docs/产品Spec.md）已完成，覆盖消费送积分、积分查看、积分兑换菜品券与结账叠加四条主流程，以及退款回退、积分过期、空态与异常提示等分支路径；规则依据需求澄清 v1.0（7 项业务规则已确认，R1–R12）。本卡点请业务 / 产品负责人对 Spec 中 5 项建议默认值进行复核确认：兑换档位表数值、退款回退取整与触发路径、券多选与 50% 上限截断细节、过期积分演示方式、存储形态（内存态 / localStorage）。确认通过后即可进入技术 Spec 设计节点。

## Decision

- Status: Pending approval
- Approved approach: _TBD_
- Decision owner: u-yevmfl73swlxswyk4gj1（需求澄清阶段负责人）
- Decision date: _TBD_

## Acceptance Criteria

- [ ] 产品目标、功能边界与验收标准足以进入技术 Spec 设计：目标可度量（GOAL-001~005），REQ 独立可测（REQ-001~009，重要验收使用 EARS、重要场景使用 Gherkin）。
- [ ] 积分获取规则明确：1 元 = 1 积分、计分基数 = 应付合计（满减后、兑换前）、向上取整、支付后入账、防重复（REQ-001）。
- [ ] 积分查看规则明确：余额 + 明细（获取 / 使用 / 回退 / 过期，倒序，含到期时间）与空态（REQ-002 / REQ-008）。
- [ ] 积分使用规则明确：仅兑换菜品券、档位表（默认 500 / 1000 / 2000）、100 积分 = 1 元、无最低门槛、余额不足被拒（REQ-003）。
- [ ] 结账叠加规则明确：应付 = 小计 − 满减 − 券价值、券抵扣 ≤ 兑换前应付合计 50%（截断、不找零、不影响入账基数）（REQ-004）。
- [ ] 异常场景覆盖：退款回退、积分过期、重复支付、抵扣超上限、空态（REQ-005 / REQ-006 / REQ-008）。
- [ ] 内存态概念演示边界明确（无后端 / 持久化 / 用户体系 / 真实支付），既有能力不回归（hash 路由、i18n、老人模式、E2E）（NG-001~004、NFR-001~004）。
- [ ] 5 项建议默认值（OQ-001~005）被确认或给出替代值；Open Questions 不阻塞下游执行。

## Verification

- Tests: 文档级自检按 prd-spec-review checklist 完成（A 组 9 项 BLOCKING 检查结论见交付说明）；代码级验证（npm run build / lint / tsc / playwright）由下游技术 Spec / 开发节点执行。
- Manual checks: 需求澄清 v1.0（R1–R12）与产品 Spec 逐条对齐：R1/R2 → REQ-001、R3 → REQ-002/007、R4/R5/R6 → REQ-003/004、R7 → REQ-006、R8 → REQ-005、R9 → REQ-003/004、R10 → REQ-004、R11 → §6.6、R12 → REQ-009。
- CI or automation: N/A（本节点为文档交付，仓库 CI 仅部署，无文档类检查）。
- Additional evidence: 仓库证据支撑变更面判断——TopBar.tsx（会员弹窗）、CheckoutView.tsx（金额链路）、orderReducer.ts（PAY / REQUEST_CANCEL / RESET）、types.ts、i18n.ts、useViewRoute.ts；约束依据仓库 AGENTS.md 与 knowledge/context。

## Blockers

None.（5 项建议默认值（OQ-001~005）已登记为待评审复核项并给出默认值，不阻塞文档交付；若复核给出不同结论，需同步修订 docs/产品Spec.md，并按澄清文档约定回写 docs/需求澄清.md 保持一致。）

## Changelog

| Time | Status Change | Updated By | Reason |
| --- | --- | --- | --- |
| 2026-09-22 | Draft created | 产品 Spec 设计节点 | 基于需求澄清 v1.0 完成产品 Spec（docs/产品Spec.md）并输出质量卡点，待负责人复核 5 项建议默认值 |
