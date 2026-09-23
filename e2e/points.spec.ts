import { test, expect, type Page, type Locator } from '@playwright/test'

// ============================================================================
// 积分功能 E2E 用例（e2e/points.spec.ts）
// 依据：docs/产品Spec.md（REQ-001~009）、docs/技术Spec.md（§4/§12 测试要点）、
//       docs/任务拆分.md（§4 自动化用例）、docs/agent-testing.md（用例规范）。
// 数据准备：DemoConsole「模拟发放积分」做确定性种子（技术Spec §1.2 / OQ-TECH-001）。
// 双语文案：zh/en 均以 i18n 实际 key 为准则（src/i18n.ts points.* / checkout.* /
//           console.* / message.*）。
// 执行边界：应用为纯前端内存态，每个用例独立（刷新即重置），可乱序执行。
// 说明：REQ-001.3（基数 ≤ 0 不入账）与 REQ-001.4（小数向上取整）在当前整数单价数据下
//       不可自然到达（技术Spec §12 防御分支），本文件按可达场景覆盖 REQ-001.1/1.2/1.5。
// ============================================================================

// ---- 业务常量（src/data/menu.ts 单价；技术Spec §9 兑换档位；满减 100-30）----
const P1 = 68 // 鎏金番茄鸳鸯锅
const P3 = 42 // 琥珀嫩牛肉
const P4 = 48 // 雪花肥牛卷
const P9 = 16 // 手工宽粉
const DISCOUNT = 30 // 小计 ≥ 100 减 30

// ---- 双语文案正则（与 src/i18n.ts 双向对齐）----
const L = {
  enterMenu: /进入点餐|Start Ordering/,
  addToCart: /加入本桌购物车|Add to Table Cart/,
  submitOrder: /确认并提交订单|Confirm & Submit Order/,
  goCheckout: /去结账|Checkout/,
  confirmPay: /^确认支付|^Confirm Payment/,
  backToOrder: /返回订单|Back to Orders/,
  memberOpen: /会员与排号|Membership & Queue/,
  consoleOpen: /演示控制台|Demo Console/,
  done: /完成设置|Done/,
  increase: /^增加$|^Increase$/,
  // zh: 退菜 / 取消；en: Cancel / Return — "退菜" 精确匹配，"Cancel" 前缀匹配
  cancelDish: /退菜|^Cancel/,
  ledger: /积分明细|Points History/,
  redeem: /积分兑换|Redeem Points/,
  redeemBtn: /^兑换$|^Redeem$/,
  balanceLabel: /当前积分|Current Points/,
  // 积分演示 section 标题（zh: 积分演示；en: Points Demo）
  pointsSectionTitle: /积分演示|Points Demo/,
  // 退菜确认 section 标题（zh: 退菜确认；en: Refund Confirmation）
  refundSectionTitle: /退菜确认|Refund Confirmation/,
  grantBtn: /模拟发放积分|Simulate Grant Points/,
  expireBtn: /模拟过期|Simulate Expiry/,
  refundConfirmBtn: /^确认退菜$|^Confirm Return$/,
  typeEarn: /获取|Earned/,
  typeRedeem: /使用|Redeemed/,
  typeRefund: /回退|Refunded/,
  typeExpire: /过期|Expired/,
  earnedLine: /获得 \d+ 积分|Earned \d+ points?/,
  redeemSuccess: /兑换成功|Redeemed successfully/,
  emptyLedger: /暂无积分记录|No points records yet/,
  emptyRedeem: /暂无可用积分|No points to redeem/,
  insufficient: /积分不足|Insufficient points/,
  noCoupons: /暂无可用兑换券|No redeemable coupons/,
  couponDeduction: /使用兑换券|Redeemed Coupon/,
  couponLimit: /超出部分不可用|exceeds 50%.*not applicable/,
  availableCouponsTitle: /可用兑换券|Redeemable Coupons/,
  grantNote: /演示发放|Demo grant/,
  expiresNextYear: new RegExp(String(new Date().getFullYear() + 1)),
}

// ---- 导航 / 数据准备辅助函数（任务拆分 §4.1）----

/** 从首页绑定 A08 桌并进入点餐视图（menu）。 */
async function enterMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: L.enterMenu }).click()
}

/**
 * 点餐页：打开指定菜品的规格弹窗（默认整份 / 默认口味 / 默认辣度）并加入购物车。
 * 注意：dishName 必须与当前语言下渲染的菜品名一致（zh 中文 / en 英文）。
 */
async function addDish(page: Page, dishName: string | RegExp) {
  const card = page.locator('article').filter({ hasText: dishName })
  await expect(card).toHaveCount(1)
  // 菜品卡片右下角唯一 Button（Plus 图标），点击打开规格弹窗
  await card.locator('button').last().click()
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

/** 打开演示控制台。 */
async function openConsole(page: Page) {
  await page.getByRole('button', { name: L.consoleOpen }).click()
}

/** 关闭演示控制台（点击「完成设置」/「Done」）。 */
async function closeConsole(page: Page) {
  await page.getByRole('button', { name: L.done }).click()
}

/** 在会员弹窗内进入「积分明细」面板。 */
async function openLedger(page: Page) {
  await page.getByRole('button', { name: L.ledger }).click()
}

/** 在会员弹窗内进入「积分兑换」面板。 */
async function openRedeem(page: Page) {
  await page.getByRole('button', { name: L.redeem }).click()
}

/** 关闭当前会员弹窗（按 ESC）。 */
async function closeMember(page: Page) {
  await page.keyboard.press('Escape')
}

/** 演示控制台 → 积分演示：模拟发放 N 积分，完成后关闭控制台。 */
async function grantPoints(page: Page, n: number) {
  await openConsole(page)
  const section = pointsDemoSection(page)
  const input = section.locator('input').first()
  await input.fill(String(n))
  await section.getByRole('button', { name: L.grantBtn }).click()
  await closeConsole(page)
}

/** 演示控制台 → 积分演示：模拟过期，完成后关闭控制台。 */
async function expirePoints(page: Page) {
  await openConsole(page)
  const section = pointsDemoSection(page)
  await section.getByRole('button', { name: L.expireBtn }).click()
  await closeConsole(page)
}

/** 定位演示控制台中的「积分演示」section。 */
function pointsDemoSection(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: L.pointsSectionTitle }) }).first()
}

/** 定位演示控制台中的「退菜确认」section。 */
function refundSection(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: L.refundSectionTitle }) }).first()
}

/**
 * 读取会员弹窗中展示的积分余额。
 * PointsSection 主面板渲染：<h3>当前积分</h3><span>N</span>（兄弟节点）；
 * 兑换面板渲染：<span>当前积分</span><strong>N</strong>。用正则从 dialog 文本抓第一个紧邻数字。
 */
async function readBalance(page: Page): Promise<number> {
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(L.balanceLabel).first()).toBeVisible()
  const text = await dialog.innerText()
  // 取第一处出现的「当前积分 ... 数字」
  const m = text.match(/当前积分[^\d]*?(\d+)/) ?? text.match(/Current Points[^\d]*?(\d+)/)
  if (!m) throw new Error(`未能从会员弹窗解析积分余额。text=${text.slice(0, 200)}`)
  return Number(m[1])
}

/**
 * 读取积分明细面板中所有带符号变动值数组（展示顺序 = 时间倒序 = 最新在前）。
 * PointsSection 渲染 <strong>+N</strong> / <strong>-N</strong>，每个独立一行；
 * 以行匹配 ±N。
 */
async function readLedgerAmounts(page: Page): Promise<number[]> {
  // 确保明细面板已打开且至少有一条「+」或「-」开头的数字行。
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/^[+-−]\d+$/).first()).toBeVisible()
  const text = await dialog.innerText()
  const amounts: number[] = []
  for (const m of text.matchAll(/^([+-−])(\d+)$/gm)) {
    const sign = m[1] === '+' ? 1 : -1
    amounts.push(sign * Number(m[2]))
  }
  return amounts
}

/**
 * 在结账页「可用兑换券」区域勾选第 n 张券（按出现顺序，0-based）。
 * CheckoutView 中券行是包含「¥N 菜品券/dish coupon」的 button，我们用 h2 标题定位区块。
 */
async function toggleCoupon(page: Page, n: number) {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: L.availableCouponsTitle }) })
  await expect(section).toBeVisible()
  // 券行 button 内包含 ¥ 与菜品券/dish coupon 文案；排除支付按钮（button 含「确认支付/Confirm Payment」）
  const couponButton = section
    .getByRole('button')
    .filter({ hasText: /¥/ })
    .nth(n)
  await couponButton.click()
}

// ============================================================================
// REQ-001 消费送积分（获取）
// ============================================================================
test.describe('REQ-001 消费送积分（获取）', () => {
  test('REQ-001.1/1.2 支付后按计分基数入账并在支付成功页反馈', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅') // p1 ¥68
    await addDish(page, '琥珀嫩牛肉') // p3 ¥42
    await addDish(page, '雪花肥牛卷') // p4 ¥48
    await goToCheckout(page)

    // 小计 158 ≥ 100 → 满减 30 → 计分基数 base=128（技术Spec §12 示例）
    const subtotal = P1 + P3 + P4
    const base = subtotal - DISCOUNT
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`).first()).toBeVisible()
    await expect(page.getByText(`-¥${DISCOUNT.toFixed(2)}`).first()).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    // 支付成功页：获得 N 积分 + 当前积分
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    await expect(page.getByText(L.balanceLabel).first()).toBeVisible()

    // 会员弹窗余额 = 计分基数 128
    await openMember(page)
    expect(await readBalance(page)).toBe(base)
  })

  test('REQ-001.5 已支付后重复进入结账不重复入账（幂等）', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click()
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()

    // 返回订单再进入结账：仍是支付成功页，不重复入账
    await page.getByRole('button', { name: L.backToOrder }).click()
    await page.getByRole('button', { name: L.goCheckout }).click()
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()

    // 打开会员弹窗 → 明细仅一条 +128，余额仍为 128
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT)
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([P1 + P3 + P4 - DISCOUNT])
    await expect(page.getByText('+128', { exact: true })).toHaveCount(1)
  })
})

// ============================================================================
// REQ-002 积分查看（余额与明细）
// ============================================================================
test.describe('REQ-002 积分查看（余额与明细）', () => {
  test('REQ-002.3 新会话积分明细空态', async ({ page }) => {
    await enterMenu(page)
    await openMember(page)
    await openLedger(page)
    await expect(page.getByRole('dialog').getByText(L.emptyLedger)).toBeVisible()
  })

  test('REQ-002.1/2.2 明细字段齐全（类型/变动值/时间/说明/到期时间）且时间倒序', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500) // 演示发放 +500（时间上最新）
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 获取 +128

    await openMember(page)
    expect(await readBalance(page)).toBe(500 + P1 + P3 + P4 - DISCOUNT)
    await openLedger(page)

    // 时间倒序：最新（演示发放 +500）在前，消费 +128 在后
    expect(await readLedgerAmounts(page)).toEqual([500, P1 + P3 + P4 - DISCOUNT])
    const dialog = page.getByRole('dialog')
    // 类型徽标（获取）、变动值 +128、时间 HH:MM、到期时间（次年）、演示发放说明
    await expect(dialog.getByText(L.typeEarn).first()).toBeVisible()
    await expect(dialog.getByText('+128', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible()
    await expect(dialog.getByText(L.expiresNextYear).first()).toBeVisible()
    await expect(dialog.getByText(L.grantNote).first()).toBeVisible()
  })
})

// ============================================================================
// REQ-003 积分兑换菜品券（使用）
// ============================================================================
test.describe('REQ-003 积分兑换菜品券（使用）', () => {
  test('REQ-003.1/3.4 余额充足兑换成功：扣减、发券、明细', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 600) // 种子 600
    await openMember(page)
    expect(await readBalance(page)).toBe(600)
    await openRedeem(page)
    // 兑换档位顺序：500 → 1000 → 2000（POINTS_TIERS），第一个「兑换」按钮为 500 档 → ¥5 券
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    await expect(redeemButtons).toHaveCount(3)
    await redeemButtons.nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()

    // 关闭并重新打开会员弹窗（主面板）确认余额 600 - 500 = 100
    await closeMember(page)
    await openMember(page)
    expect(await readBalance(page)).toBe(100)
    // 明细新增「使用 −500」（兑换是最新操作，展示为第一条）
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([-500])
    await expect(page.getByRole('dialog').getByText(L.typeRedeem).first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText('-500', { exact: true })).toBeVisible()
  })

  test('REQ-003.3 余额不足时兑换按钮禁用并提示「积分不足」', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 600)
    await openMember(page)
    await openRedeem(page)
    // 先兑换 500 档：600 - 500 = 100
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    await redeemButtons.nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    // 此时 500 档（nth(0)）按钮应被禁用且显示「积分不足」
    await expect(redeemButtons.nth(0)).toBeDisabled()
    await expect(page.getByRole('dialog').getByText(L.insufficient).first()).toBeVisible()
    // 关闭弹窗再查余额：仍为 100，未再次扣减
    await closeMember(page)
    await openMember(page)
    expect(await readBalance(page)).toBe(100)
  })

  test('REQ-003.5 余额为 0 时兑换区空态「暂无可用积分」', async ({ page }) => {
    await enterMenu(page)
    await openMember(page)
    await openRedeem(page)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
  })
})

// ============================================================================
// REQ-004 结账使用兑换券叠加抵扣
// ============================================================================
test.describe('REQ-004 结账使用兑换券叠加抵扣', () => {
  test('REQ-004.2/4.5 兑换券与满减叠加且不影响入账基数', async ({ page }) => {
    await enterMenu(page)
    // 种子 1000 → 兑换 1000 档 ¥10 券
    await grantPoints(page, 1000)
    await openMember(page)
    await openRedeem(page)
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(1).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    await closeMember(page)

    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)

    // base 128 + ¥10 券 → 应付 118；入账仍按 base 128
    const base = P1 + P3 + P4 - DISCOUNT
    const couponValue = 10
    await toggleCoupon(page, 0)
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    await expect(page.getByText(`¥${(base - couponValue).toFixed(2)}`).first()).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    // 余额 = 0（券核销）+ 入账 128 = 128（券已核销 used=true，不再计入余额可用券）
    await openMember(page)
    expect(await readBalance(page)).toBe(base)
  })

  test('REQ-004.3/4.4 抵扣超过 50% 上限时截断、提示且不找零不为负', async ({ page }) => {
    await enterMenu(page)
    // 种子 5000，兑换 ¥20 券 1 张 + ¥10 券 3 张（合计 50）
    await grantPoints(page, 5000)
    await openMember(page)
    await openRedeem(page)
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    await redeemButtons.nth(2).click() // 2000 → ¥20
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await closeMember(page)

    // 构造小计 80（< 100 无满减）：手工宽粉 ¥16 × 5 = ¥80（1 次 addDish + 4 次 + ）
    await addDish(page, '手工宽粉')
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: L.increase }).first().click()
    }
    await goToCheckout(page)

    const subtotal = P9 * 5 // 80
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`).first()).toBeVisible()

    // 券合计 50 > 上限 80×50% = 40 → 实际抵扣 40、应付 40、提示超出部分不可用
    const cap = subtotal * 0.5 // 40
    for (let i = 0; i < 4; i++) await toggleCoupon(page, 0) // 逐张勾选（每次点第 0 张）
    await expect(page.getByText(L.couponLimit).first()).toBeVisible()
    await expect(page.getByText(`¥${cap.toFixed(2)}`).first()).toBeVisible()
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    // 应付 = 40（不为负、不找零）
    await expect(page.getByRole('button', { name: L.confirmPay })).toContainText('¥40.00')
  })
})

// ============================================================================
// REQ-005 退款 / 退菜回退积分
// ============================================================================
test.describe('REQ-005 退款/退菜回退积分', () => {
  test('REQ-005.1 支付后退菜确认按金额回退积分', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 入账 128
    await page.getByRole('button', { name: L.backToOrder }).click()

    // orderItems 顺序 = p1、p3、p4；对 p3（第二项，¥42）发起退菜申请
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    // 在演示控制台退菜确认区确认
    await openConsole(page)
    const rSec = refundSection(page)
    await rSec.getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 余额 128 - 42 = 86；明细倒序：回退 -42、获取 +128
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT - P3)
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([-P3, P1 + P3 + P4 - DISCOUNT])
    await expect(page.getByRole('dialog').getByText(L.typeRefund).first()).toBeVisible()
  })

  test('REQ-005.3 未支付退菜确认不回退积分（仅 approved）', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.backToOrder }).click() // 未支付
    await page.getByRole('button', { name: L.cancelDish }).first().click()
    await openConsole(page)
    await refundSection(page).getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 未支付：无积分回退，余额仍为 0、明细空态
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    await expect(page.getByRole('dialog').getByText(L.emptyLedger)).toBeVisible()
  })

  test('REQ-005.2 多笔回退超过余额时按 0 截断不为负', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅') // 68
    await addDish(page, '琥珀嫩牛肉') // 42
    await addDish(page, '雪花肥牛卷') // 48
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 入账 128
    await page.getByRole('button', { name: L.backToOrder }).click()

    // 对全部 3 项发起退菜申请（每次点 nth(0)，因为按钮被徽章替换后下一个变 nth(0)）
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: L.cancelDish }).nth(0).click()
    }
    await openConsole(page)
    const rSec = refundSection(page)
    const confirmBtn = rSec.getByRole('button', { name: L.refundConfirmBtn })
    await expect(confirmBtn).toHaveCount(3)
    // 逐一点击第 0 个确认按钮，每确认一项，该项从列表移除
    for (let i = 0; i < 3; i++) {
      await confirmBtn.nth(0).click()
    }
    await closeConsole(page)

    // 余额 0 截断；明细：三笔回退（-48、-42、-68，顺序取决于处理顺序）+ 入账 +128，总和 = 0
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    const amounts = await readLedgerAmounts(page)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(0)
    // 入账 +128 必须存在；三笔负向合计应等于 -128
    expect(amounts).toContain(P1 + P3 + P4 - DISCOUNT)
    const negSum = amounts.filter((v) => v < 0).reduce((a, b) => a + b, 0)
    expect(negSum).toBe(-(P1 + P3 + P4 - DISCOUNT))
  })
})

// ============================================================================
// REQ-006 积分过期处理
// ============================================================================
test.describe('REQ-006 积分过期处理', () => {
  test('REQ-006.1 earn 明细展示到期时间（+12 个月）', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500)
    await openMember(page)
    await openLedger(page)
    // 演示发放是 earn 类型，显示次年到期
    await expect(page.getByRole('dialog').getByText(L.expiresNextYear).first()).toBeVisible()
  })

  test('REQ-006.2/6.3 模拟过期后余额剔除、明细「过期」、不可兑换', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500)
    await expirePoints(page)

    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([-500])
    await expect(page.getByRole('dialog').getByText(L.typeExpire).first()).toBeVisible()
    // 过期后兑换区空态
    await page.getByRole('button', { name: /^返回$|^Back$/ }).click()
    await openRedeem(page)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
  })
})

// ============================================================================
// REQ-007 积分余额一致性
// ============================================================================
test.describe('REQ-007 积分余额一致性', () => {
  test('REQ-007.1/7.2 混合操作后展示余额 = 明细变动值合计', async ({ page }) => {
    await enterMenu(page)
    // earn 128：p1+p3+p4=158 → 满减 30 → 基数 128
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click()
    await page.getByRole('button', { name: L.backToOrder }).click()

    // grant +500（演示发放）
    await grantPoints(page, 500)
    // redeem −500（兑换）
    await openMember(page)
    await openRedeem(page)
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    await closeMember(page)
    // refund −42（p3 退菜确认）
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    await openConsole(page)
    await refundSection(page).getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 期望余额 = 128 + 500 - 500 - 42 = 86，等于明细合计
    const expected = P1 + P3 + P4 - DISCOUNT + 500 - 500 - P3
    await openMember(page)
    expect(await readBalance(page)).toBe(expected)
    await openLedger(page)
    const amounts = await readLedgerAmounts(page)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(expected)
  })
})

// ============================================================================
// REQ-008 空态与异常提示
// ============================================================================
test.describe('REQ-008 空态与异常提示', () => {
  test('REQ-008.2 无可用兑换券时结账页说明「暂无可用兑换券」', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await goToCheckout(page)
    await expect(page.getByText(L.noCoupons)).toBeVisible()
  })
})

// ============================================================================
// REQ-009 多语言（zh/en）
// ============================================================================
test.describe('REQ-009 多语言（zh/en）', () => {
  test('REQ-009.1/9.2 切换 EN 后积分文案英文且无缺失 key', async ({ page }) => {
    await enterMenu(page)
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()

    // 英文环境完成「种子 → 兑换 → 结账使用 → 支付」闭环
    await grantPoints(page, 1000)
    await openMember(page)
    await expect(page.getByText(/Current Points/).first()).toBeVisible()
    await openRedeem(page)
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 → ¥10
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    await closeMember(page)

    await addDish(page, 'Golden Tomato Dual-Flavor Pot')
    await addDish(page, 'Amber Tender Beef')
    await addDish(page, 'Marbled Beef Rolls')
    await goToCheckout(page)
    await toggleCoupon(page, 0)
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    await page.getByRole('button', { name: L.confirmPay }).click()

    // 支付成功页英文：Earned 128 points / Current Points
    await expect(page.getByText(/Earned 128 points?/).first()).toBeVisible()
    await expect(page.getByText(/Current Points/).first()).toBeVisible()

    // 会员弹窗英文：余额 / 明细入口 / 明细类型
    await openMember(page)
    await expect(page.getByText(/Current Points/).first()).toBeVisible()
    await openLedger(page)
    await expect(page.getByRole('dialog').getByText(L.typeEarn).first()).toBeVisible()

    // 不出现字面 i18n key（形如 points.xxx / checkout.xxx / console.xxx / message.xxx）
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/\b(?:points|checkout|console|message)\.[a-z_]+\b/)
  })
})
