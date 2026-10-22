# Exploratory Testing Session Report

## 1. 基本信息
- Charter: <见 charter 段>
- 环境: URL / commit / 浏览器 / 视口
- 时间盒: 实际用时 / 计划用时

## 2. 覆盖率结果
| 指标 | 值 | 阈值 | 是否达标 |
| --- | --- | --- | --- |
| 结构一致率 S |  | ≥0.98 | ✅/❌ |
| 交互覆盖率 V |  | ≥0.95 | ✅/❌ |
| 状态覆盖率 C |  | 1.00 | ✅/❌ |
| Console errors |  | 0 | ✅/❌ |

- 未覆盖元素清单（带排除码或 bug_id）：<table>
- 视图×状态矩阵打勾：<table>

## 3. Bug 清单
| ID | 严重度 | 视图/状态 | 标题 | 复现步骤 | 预期 | 实际 | 截图/录像 | 建议归属 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | S? |  |  |  |  |  |  | 前端/产品/后端 |

## 4. Console / Network 异常
- （逐条列出，含 EX-KNOWN 标注）

## 5. 反模式清单执行结果
- （引用 rules/risks.md，逐项打 ✅/❌/n/a，❌ 关联 bug_id）

## 6. 建议补入 E2E 的用例片段
```ts
// Playwright 片段，每条对应一个发现的 bug
test('ET-B-01: ...', async ({page}) => { ... });
```

## 7. 结论
- [ ] 通过：覆盖率达标、无 S0/S1 未解决问题，可发布
- [ ] 有条件通过：S2 及以下问题已记录，带遗留进入发布
- [ ] 不通过：S0/S1 存在或覆盖率不达标，阻塞发布
- [ ] 阻塞：环境/权限/数据问题无法继续

## 8. 附件
- inventory.json
- visited.json
- console-errors.json
- screenshots/
