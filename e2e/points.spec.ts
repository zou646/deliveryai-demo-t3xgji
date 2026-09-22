import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// 积分功能 E2E 用例（e2e/points.spec.ts）
// 依据：docs/产品Spec.md（REQ-001~009）、docs/技术Spec.md（§4/§12 测试要点）、
//       docs/任务拆分.md（§4 自动化用例）、docs/agent-testing.md（用例规范）。
// 数据准备：优先使用 DemoConsole「模拟发放积分」做确定性种子（技术Spec §1.2 / OQ-TECH-001）。
// 双语文案：zh/en 用正则兼容（i18n 契约见技术Spec §4.3 / 产品Spec §5.6 建议文案）。
// 执行边界：应用为纯前端内存态，每个用例独立（刷新即重置），可乱序执行。
// 说明：REQ-001.3（基数 ≤ 0 不入账）与 REQ-001.4（小数向上取整）在当前整数单价数据下
//       不可自然到达（技术Spec §12 记为防御分支），本文件按可达场景覆盖 REQ-001.1/1.2/1.5。
// ============================================================================

// ---- 业务常量（来源：src/data/menu.ts 单价、技术Spec §9 兑换档位与满减规则）----
const P1 = 68 // 鎏金番茄鸳鸯锅
const P3 = 42 // 琥珀嫩牛肉
const P4 = 48 // 雪花肥牛卷
const P9 = 16 // 手工宽粉
const DISCOUNT = 30 // 满减：小计 ≥ 100 减 30

// ---- 双语交互文案（zh | en，与 i18n 契约 / 产品Spec §5.6 建议文案一致）----
const L = {
  enterMenu: /进入点餐|Start Ordering/,
  addToCart: /加入本桌购物车|Add to Table Cart/,
  submitOrder: /确认并提交订单|Confirm & Submit Order/,
  goCheckout: /去结账|Checkout/,
  confirmPay: /确认支付|Confirm Payment/,
  backToOrder: /返回订单|Back to Orders/,
  memberOpen: /会员与排号|Membership & Queue/,
  consoleOpen: /演示控制台|Demo Console/,
  done: /完成设置|Done/,
  increase: /增加|Increase/,
  cancelDish: /退菜|Cancel/,
  ledger: /积分明细|Points History/,
  redeem: /积分兑换|Redeem Points/,
  redeemBtn: /^兑换$|^Redeem$/,
  balanceLabel: /当前积分|Current Points/,
  grantSection: /积分演示|模拟发放积分|Grant Points|Points Demo/,
  grantBtn: /模拟发放积分|Grant Points/,
  expireBtn: /模拟过期|Expire Points/,
  refundSection: /退菜确认|Refund Confirmation|Refund/,
  refundConfirm: /确认退菜|Confirm Refund|Refund/,
  typeEarn: /获取|Earn/,
  typeExpire: /过期|Expir/,
  earnedLine: /获得 \d+ 积分|Earned \d+/,
  emptyLedger: /暂无积分记录|No points records yet/,
  emptyRedeem: /暂无可用积分|No points to redeem/,
  insufficient: /积分不足|Insufficient points/,
  noCoupons: /暂无可用兑换券|No redeemable coupons/,
  couponDeduction: /使用兑换券|Redeemed coupon/,
  couponLimit: /超出部分不可用|exceeds 50%|not applicable/,
}

// ---- 导航 / 数据准备辅助函数（任务拆分 §4.1）----

/** 从首页绑定 A08 桌并进入点餐视图（menu）。 */
async function enterMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click() // home → welcome
  await page.getByRole('button', { name: L.enterMenu }).click() // welcome → menu
}

/** 点餐页：把指定菜品（默认整份 / 默认口味 / 默认辣度）加入本桌购物车。 */
async function addDish(page: Page, dishName: string) {
  const card = page.locator('article').filter({ hasText: dishName })
  await card.locator('button').first().click() // 打开菜品规格弹窗
  await page.getByRole('button', { name: L.addToCart }).click()
}

/** 提交订单并进入结账页（menu → order → checkout）。 */
async function goToCheckout(page: Page) {
  await page.getByRole('button', { name: L.submitOrder }).click()
  await page.getByRole('button', { name: L.goCheckout }).click()
}

/** 打开顶栏「会员与排号」弹窗。 */
async function openMember(page: Page) {
  await page.getByRole('button', { name: L.memberOpen }).click()
}

/** 打开「演示控制台」。 */
async function openConsole(page: Page) {
  await page.getByRole('button', { name: L.consoleOpen }).click()
}

/**
 * 会员弹窗内面板切换（「积分明细」/「积分兑换」）。
 * 兼容 button / tab / 纯文本三种实现，避免依赖具体 DOM 角色。
 */
async function clickPointsPanel(page: Page, name: RegExp) {
  const button = page.getByRole('button', { name })
  if ((await button.count()) > 0) {
    await button.first().click()
    return
  }
  const tab = page.getByRole('tab', { name })
  if ((await tab.count()) > 0) {
    await tab.first().click()
    return
  }
  await page.getByText(name).first().click()
}

/** 演示控制台「积分演示」区：模拟发放 N 积分（发放后关闭控制台）。 */
async function grantPoints(page: Page, n: number) {
  await openConsole(page)
  const section = page.locator('section').filter({ hasText: L.grantSection }).first()
  await section.locator('input').first().fill(String(n))
  await section.getByRole('button', { name: L.grantBtn }).click()
  await page.getByRole('button', { name: L.done }).click()
}

/** 演示控制台「积分演示」区：模拟过期（完成后关闭控制台）。 */
async function expirePoints(page: Page) {
  await openConsole(page)
  const section = page.locator('section').filter({ hasText: L.grantSection }).first()
  await section.getByRole('button', { name: L.expireBtn }).click()
  await page.getByRole('button', { name: L.done }).click()
}

/** 读取会员弹窗中「当前积分」标签后的余额数值（主面板 / 兑换面板均可）。 */
async function readBalance(page: Page): Promise<number> {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(L.balanceLabel).first()).toBeVisible()
  const text = await dialog.innerText()
  const m = text.match(/当前积分[^\d]*(\d+)/) ?? text.match(/Current Points[^\d]*(\d+)/)
  if (!m) throw new Error('未能从会员弹窗解析积分余额')
  return Number(m[1])
}

/** 读取会员弹窗中积分明细的所有带符号变动值（展示顺序 = 时间倒序）。 */
async function readLedgerAmounts(page: Page): Promise<number[]> {
  const text = await page.getByRole('dialog').innerText()
  const amounts: number[] = []
  for (const m of text.matchAll(/^([+-−])(\d+)$/gm)) {
    amounts.push(m[1] === '+' ? Number(m[2]) : -Number(m[2]))
  }
  return amounts
}

/** 结账页勾选「可用兑换券」：优先 checkbox 角色，兜底点击含面值文案的券行。 */
async function selectCoupons(page: Page, count: number) {
  const checkboxes = page.getByRole('checkbox')
  if ((await checkboxes.count()) > 0) {
    await expect(checkboxes).toHaveCount(count)
    for (let i = 0; i < count; i++) await checkboxes.nth(i).click()
    return
  }
  const rows = page
    .locator('button')
    .filter({ hasText: /¥\d+/ })
    .filter({ hasNotText: L.confirmPay })
  await expect(rows).toHaveCount(count)
  for (let i = 0; i < count; i++) await rows.nth(i).click()
}

// ============================================================================
// REQ-001 消费送积分（获取）
// ============================================================================
test.describe('积分功能 E2E：REQ-001 消费送积分（获取）', () => {
  test('REQ-001.1/1.2: 支付后按计分基数入账并在支付成功页反馈', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅') // p1 ¥68
    await addDish(page, '琥珀嫩牛肉') // p3 ¥42
    await addDish(page, '雪花肥牛卷') // p4 ¥48
    await goToCheckout(page)

    // 小计 158 ≥ 100 → 满减 30 → 计分基数 128（技术Spec §12 示例）
    const subtotal = P1 + P3 + P4
    const base = subtotal - DISCOUNT
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`, { exact: true })).toBeVisible()
    await expect(page.getByText(`-¥${DISCOUNT.toFixed(2)}`, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    // 支付成功页：获得 N 积分 + 当前积分
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    await expect(page.getByText(L.balanceLabel).first()).toBeVisible()

    // 会员弹窗余额 = 计分基数（128）
    await openMember(page)
    expect(await readBalance(page)).toBe(base)
  })

  test('REQ-001.5: 已支付后重复进入结账不重复入账（幂等）', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click()
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()

    // 返回订单再进入结账：仍为支付成功页，不重复入账
    await page.getByRole('button', { name: L.backToOrder }).click()
    await page.getByRole('button', { name: L.goCheckout }).click()
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()

    // 明细仍只有一条 +128（获取），余额不变
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT)
    await clickPointsPanel(page, L.ledger)
    expect(await readLedgerAmounts(page)).toEqual([P1 + P3 + P4 - DISCOUNT])
  })
})

// ============================================================================
// REQ-002 积分查看（余额与明细）
// ============================================================================
test.describe('积分功能 E2E：REQ-002 积分查看（余额与明细）', () => {
  test('REQ-002.3: 新会话积分明细空态「暂无积分记录」', async ({ page }) => {
    await enterMenu(page)
    await openMember(page)
    await clickPointsPanel(page, L.ledger)
    await expect(page.getByRole('dialog').getByText(L.emptyLedger)).toBeVisible()
  })

  test('REQ-002.1/2.2: 明细字段齐全且时间倒序', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500) // 演示发放 +500（最新）
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 获取 +128
    await openMember(page)
    expect(await readBalance(page)).toBe(500 + P1 + P3 + P4 - DISCOUNT)

    await clickPointsPanel(page, L.ledger)
    const dialog = page.getByRole('dialog')
    // 时间倒序：最新（演示发放 +500）在前，获取 +128 在后
    expect(await readLedgerAmounts(page)).toEqual([500, P1 + P3 + P4 - DISCOUNT])
    // earn 明细字段：类型「获取」、变动值 +128、时间 HH:MM、说明、到期时间（+12 个月 → 明年）
    await expect(dialog.getByText(L.typeEarn).first()).toBeVisible()
    await expect(dialog.getByText(/[+]128/).first()).toBeVisible()
    await expect(dialog.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible()
    await expect(dialog.getByText(new RegExp(String(new Date().getFullYear() + 1))).first()).toBeVisible()
    // 演示发放明细说明（技术Spec：GRANT_POINTS note=演示发放）
    await expect(dialog.getByText(/演示发放/).first()).toBeVisible()
  })
})

// ============================================================================
// REQ-003 积分兑换菜品券（使用）
// ============================================================================
test.describe('积分功能 E2E：REQ-003 积分兑换菜品券（使用）', () => {
  test('REQ-003.1/3.4: 余额充足兑换成功：扣减、发券、明细', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 600) // 种子 600
    await openMember(page)
    expect(await readBalance(page)).toBe(600)
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(0).click() // 500 档 → ¥5 券
    await expect(page.getByText(/兑换成功|Redeemed successfully/).first()).toBeVisible()

    // 重开会员弹窗（主面板）确认余额 600 - 500 = 100
    await page.keyboard.press('Escape')
    await openMember(page)
    expect(await readBalance(page)).toBe(100)
    // 明细新增「使用 −500」
    await clickPointsPanel(page, L.ledger)
    expect(await readLedgerAmounts(page)).toEqual([-500])
    await expect(page.getByRole('dialog').getByText(/使用|Redeem/).first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText(/[-−]500/)).toBeVisible()
  })

  test('REQ-003.3: 余额不足时兑换禁用并提示「积分不足」', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 600)
    await openMember(page)
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(0).click() // 600 - 500 = 100
    // 余额 100 < 500：兑换按钮禁用并提示，余额不变
    await expect(page.getByRole('button', { name: L.redeemBtn }).nth(0)).toBeDisabled()
    await expect(page.getByRole('dialog').getByText(L.insufficient).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await openMember(page)
    expect(await readBalance(page)).toBe(100)
  })

  test('REQ-003.5: 余额为 0 时兑换区空态「暂无可用积分」', async ({ page }) => {
    await enterMenu(page)
    await openMember(page)
    await clickPointsPanel(page, L.redeem)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
  })
})

// ============================================================================
// REQ-004 结账使用兑换券叠加抵扣
// ============================================================================
test.describe('积分功能 E2E：REQ-004 结账使用兑换券叠加抵扣', () => {
  test('REQ-004.2/4.5: 兑换券与满减叠加，且不影响入账基数', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 1000)
    await openMember(page)
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 档 → ¥10 券
    await page.keyboard.press('Escape')

    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)

    // base 128 + ¥10 券 → 应付 118（技术Spec §12 示例）
    const base = P1 + P3 + P4 - DISCOUNT
    const couponValue = 10
    await selectCoupons(page, 1)
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    await expect(page.getByText(`¥${(base - couponValue).toFixed(2)}`, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    // 入账基数仍为兑换前 basePayable：获得 128 积分；余额 = 0 + 128 = 128
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    await openMember(page)
    expect(await readBalance(page)).toBe(base)
  })

  test('REQ-004.3/4.4: 抵扣超过 50% 上限时截断、提示且不找零不为负', async ({ page }) => {
    await enterMenu(page)
    // 种子 5000：兑换 ¥20（2000 档）+ ¥10×3（1000 档）= 券面值合计 50
    await grantPoints(page, 5000)
    await openMember(page)
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(2).click() // 2000 → ¥20
    await page.getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 → ¥10
    await page.getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 → ¥10
    await page.getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 → ¥10
    await page.keyboard.press('Escape')

    // 构造小计 80（< 100 无满减）：手工宽粉 16 × 5 = 80
    await addDish(page, '手工宽粉')
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: L.increase }).click()
    }
    await goToCheckout(page)
    const subtotal = P9 * 5 // 80
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`, { exact: true })).toBeVisible()

    // 券合计 50 > 上限 80×50% = 40 → 实际抵扣 40、应付 40、提示超出部分不可用
    const cap = subtotal * 0.5 // 40
    await selectCoupons(page, 4)
    await expect(page.getByText(L.couponLimit).first()).toBeVisible()
    await expect(page.getByText(`¥${cap.toFixed(2)}`, { exact: true })).toBeVisible()
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
  })
})

// ============================================================================
// REQ-005 退款 / 退菜回退积分
// ============================================================================
test.describe('积分功能 E2E：REQ-005 退款/退菜回退积分', () => {
  test('REQ-005.1: 支付后退菜确认按金额回退积分', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 入账 128
    await page.getByRole('button', { name: L.backToOrder }).click()

    // 对 p3（第二项，¥42）发起退菜申请
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    await openConsole(page)
    const refundSection = page.locator('section').filter({ hasText: L.refundSection }).first()
    await refundSection.getByRole('button', { name: L.refundConfirm }).click()
    await page.getByRole('button', { name: L.done }).click()

    // 余额 128 - 42 = 86；明细「回退 −42」（倒序在前）
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT - P3)
    await clickPointsPanel(page, L.ledger)
    expect(await readLedgerAmounts(page)).toEqual([-P3, P1 + P3 + P4 - DISCOUNT])
    await expect(page.getByRole('dialog').getByText(/回退|Refund/).first()).toBeVisible()
  })

  test('REQ-005.3: 未支付退菜确认不回退积分（仅 approved）', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await goToCheckout(page) // 不支付
    await page.getByRole('button', { name: L.backToOrder }).click()
    await page.getByRole('button', { name: L.cancelDish }).first().click()
    await openConsole(page)
    const refundSection = page.locator('section').filter({ hasText: L.refundSection }).first()
    await refundSection.getByRole('button', { name: L.refundConfirm }).click()
    await page.getByRole('button', { name: L.done }).click()

    // 未支付：无积分回退，余额仍为 0、明细为空
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await clickPointsPanel(page, L.ledger)
    await expect(page.getByRole('dialog').getByText(L.emptyLedger)).toBeVisible()
  })

  test('REQ-005.2: 多笔回退超过余额时按 0 截断不为负', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅') // 68
    await addDish(page, '琥珀嫩牛肉') // 42
    await addDish(page, '雪花肥牛卷') // 48
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 入账 128
    await page.getByRole('button', { name: L.backToOrder }).click()

    // 三项全部申请退菜（68 + 42 + 48 = 158 > 128）
    await page.getByRole('button', { name: L.cancelDish }).nth(0).click()
    await page.getByRole('button', { name: L.cancelDish }).nth(0).click()
    await page.getByRole('button', { name: L.cancelDish }).nth(0).click()

    await openConsole(page)
    const refundSection = page.locator('section').filter({ hasText: L.refundSection }).first()
    const confirmBtns = refundSection.getByRole('button', { name: L.refundConfirm })
    await expect(confirmBtns).toHaveCount(3)
    for (let i = 0; i < 3; i++) await confirmBtns.nth(0).click()
    await page.getByRole('button', { name: L.done }).click()

    // 余额按 0 截断，不为负；回退明细 −68/−42/−48 均可查
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await clickPointsPanel(page, L.ledger)
    expect(await readLedgerAmounts(page)).toEqual([-P4, -P3, -P1, P1 + P3 + P4 - DISCOUNT])
  })
})

// ============================================================================
// REQ-006 积分过期处理
// ============================================================================
test.describe('积分功能 E2E：REQ-006 积分过期处理', () => {
  test('REQ-006.2/6.3: 模拟过期后余额剔除、明细「过期」、不可兑换', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500)
    await expirePoints(page)

    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await clickPointsPanel(page, L.ledger)
    expect(await readLedgerAmounts(page)).toEqual([-500])
    await expect(page.getByRole('dialog').getByText(L.typeExpire).first()).toBeVisible()
    // 过期后不可兑换：余额 0 → 兑换区空态
    await clickPointsPanel(page, L.redeem)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
  })
})

// ============================================================================
// REQ-007 积分余额一致性
// ============================================================================
test.describe('积分功能 E2E：REQ-007 积分余额一致性', () => {
  test('REQ-007.1/7.2: 混合操作后展示余额 = 明细变动值合计', async ({ page }) => {
    await enterMenu(page)
    // earn 128：p1+p3+p4 = 158 → 满减 30 → 基数 128
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click()
    await page.getByRole('button', { name: L.backToOrder }).click()

    // grant +500（演示发放）
    await grantPoints(page, 500)
    // redeem −500（使用）
    await openMember(page)
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(0).click()
    await page.keyboard.press('Escape')
    // refund −42（p3 退菜确认）
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    await openConsole(page)
    const refundSection = page.locator('section').filter({ hasText: L.refundSection }).first()
    await refundSection.getByRole('button', { name: L.refundConfirm }).click()
    await page.getByRole('button', { name: L.done }).click()

    // 展示余额 = 128 + 500 - 500 - 42 = 86 = 明细合计
    await openMember(page)
    const balance = await readBalance(page)
    expect(balance).toBe(P1 + P3 + P4 - DISCOUNT + 500 - 500 - P3)
    await clickPointsPanel(page, L.ledger)
    const sum = (await readLedgerAmounts(page)).reduce((a, b) => a + b, 0)
    expect(sum).toBe(balance)
  })
})

// ============================================================================
// REQ-008 空态与异常提示
// ============================================================================
test.describe('积分功能 E2E：REQ-008 空态与异常提示', () => {
  test('REQ-008.2: 无可用兑换券时结账页说明「暂无可用兑换券」', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await goToCheckout(page)
    await expect(page.getByText(L.noCoupons)).toBeVisible()
  })
})

// ============================================================================
// REQ-009 多语言（zh/en）
// ============================================================================
test.describe('积分功能 E2E：REQ-009 多语言（zh/en）', () => {
  test('REQ-009.1/9.2: 切换 EN 后积分文案为英文且无缺失 key', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()

    // 英文环境完成「种子 → 兑换 → 结账使用 → 支付」闭环
    await grantPoints(page, 1000)
    await openMember(page)
    await expect(page.getByText(/Current Points/).first()).toBeVisible()
    await clickPointsPanel(page, L.redeem)
    await page.getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 → ¥10
    await page.keyboard.press('Escape')

    await addDish(page, 'Golden Tomato Dual-Flavor Pot')
    await addDish(page, 'Amber Tender Beef')
    await addDish(page, 'Marbled Beef Rolls')
    await goToCheckout(page)
    await selectCoupons(page, 1)
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    await page.getByRole('button', { name: L.confirmPay }).click()

    // 支付成功页英文：Earned 128 / Current Points
    await expect(page.getByText(/Earned 128/).first()).toBeVisible()
    await expect(page.getByText(/Current Points/).first()).toBeVisible()

    // 会员弹窗英文：余额 / 明细入口 / 明细类型
    await openMember(page)
    await expect(page.getByText(/Current Points/).first()).toBeVisible()
    await clickPointsPanel(page, L.ledger)
    await expect(page.getByRole('dialog').getByText(/Earned/).first()).toBeVisible()

    // 无缺失 i18n key（不出现字面 key，如 points.balance / checkout.* 等）
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/(?:points|checkout|console|message)\.[a-z_]+/)
  })
})
