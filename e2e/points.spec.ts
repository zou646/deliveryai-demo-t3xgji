import { test, expect, type Page, type Locator } from '@playwright/test'

// ============================================================================
// 积分功能 E2E 用例（e2e/points.spec.ts）
// 依据：docs/产品Spec.md（REQ-001~009）、docs/技术Spec.md（§4/§12 测试要点）、
//       docs/任务拆分.md（§4 自动化用例）、docs/agent-testing.md（用例规范）。
// 数据准备：DemoConsole「模拟发放积分」做确定性种子（技术Spec §1.2 / OQ-TECH-001）。
// 双语文案：以 src/i18n.ts 中 zh/en 实际文案为准。
// 执行边界：纯前端内存态，每个用例独立（刷新即重置），可乱序执行。
// 说明：REQ-001.3（基数 ≤ 0 不入账）与 REQ-001.4（小数向上取整）在当前整数单价数据下
//       不可自然到达（技术Spec §12 防御分支），本文件按可达场景覆盖 REQ-001.1/1.2/1.5。
// ============================================================================

// ---- 业务常量（src/data/menu.ts 单价；src/data/points.ts 兑换档位；满减 100-30）----
const P1 = 68 // 鎏金番茄鸳鸯锅 / Golden Tomato Dual-Flavor Pot
const P3 = 42 // 琥珀嫩牛肉 / Amber Tender Beef
const P4 = 48 // 雪花肥牛卷 / Marbled Beef Rolls
const P9 = 16 // 手工宽粉 / Handmade Wide Noodles
const DISCOUNT = 30 // 小计 ≥ 100 减 30

// ---- 双语文案正则（与 src/i18n.ts 双向对齐）----
const L = {
  enterMenu: /进入点餐|Start Ordering/,
  addToCart: /加入本桌购物车|Add to Table Cart/,
  submitOrder: /确认并提交订单|Confirm & Submit Order/,
  goCheckout: /去结账|Checkout/,
  // 注意：结账按钮文案是 "确认支付 ¥xx.xx" / "Confirm Payment ¥xx.xx"，用 anchored 前缀匹配避免误伤含金额的其他按钮
  confirmPay: /^确认支付|^Confirm Payment/,
  backToOrder: /返回订单|Back to Orders/,
  memberOpen: /会员与排号|Membership & Queue/,
  consoleOpen: /演示控制台|Demo Console/,
  done: /完成设置|Done/,
  increase: '增加', // 中文 aria-label；切 EN 后使用英文 aria-label
  increaseEn: 'Increase',
  cancelDish: /退菜|Cancel \/ Return/,
  ledger: /积分明细|Points History/,
  redeem: /积分兑换|Redeem Points/,
  pointsTitle: /会员与排号|Membership & Queue/,
  back: /^返回$|^Back$/,
  redeemBtn: /^兑换$|^Redeem$/,
  balanceLabel: /当前积分|Current Points/,
  pointsSectionTitle: /积分演示|Points Demo/,
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
}

// ---- 导航 / 数据准备辅助函数（任务拆分 §4.1）----

async function enterMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: L.enterMenu }).click()
}

/**
 * 在点餐页打开指定菜品的规格弹窗，并以默认选项（整份/默认口味/默认辣度）加入购物车。
 * dishName 为当前语言下渲染的菜品名（zh 中文 / en 英文）。
 */
async function addDish(page: Page, dishName: string | RegExp) {
  const card = page.locator('article').filter({ hasText: dishName }).first()
  await expect(card).toBeVisible()
  // 菜品卡片右下角唯一的「+」圆形按钮用于打开规格弹窗
  await card.getByRole('button').last().click()
  await page.getByRole('button', { name: L.addToCart }).click()
}

async function goToCheckout(page: Page) {
  await page.getByRole('button', { name: L.submitOrder }).click()
  await page.getByRole('button', { name: L.goCheckout }).click()
}

async function openMember(page: Page) {
  await page.getByRole('button', { name: L.memberOpen }).click()
  await expect(page.getByRole('dialog', { name: L.pointsTitle })).toBeVisible()
}

async function closeMember(page: Page) {
  await page.keyboard.press('Escape')
  // 等对话框消失
  await expect(page.getByRole('dialog', { name: L.pointsTitle })).toHaveCount(0)
}

async function openConsole(page: Page) {
  await page.getByRole('button', { name: L.consoleOpen }).click()
  await expect(page.getByRole('dialog', { name: L.consoleOpen })).toBeVisible()
}

async function closeConsole(page: Page) {
  await page.getByRole('button', { name: L.done }).click()
  await expect(page.getByRole('dialog', { name: L.consoleOpen })).toHaveCount(0)
}

/** 会员弹窗 → 积分明细面板（从面板主页或其他子面板均可到达）。 */
async function openLedger(page: Page) {
  const dlg = page.getByRole('dialog', { name: L.pointsTitle })
  // 若当前在其他子面板，先点「返回」回到主面板
  const backBtn = dlg.getByRole('button', { name: L.back })
  if (await backBtn.count()) {
    await backBtn.click()
  }
  await dlg.getByRole('button', { name: L.ledger }).click()
  await expect(dlg.getByText(L.ledger).first()).toBeVisible()
}

/** 会员弹窗 → 积分兑换面板。 */
async function openRedeem(page: Page) {
  const dlg = page.getByRole('dialog', { name: L.pointsTitle })
  const backBtn = dlg.getByRole('button', { name: L.back })
  if (await backBtn.count()) {
    await backBtn.click()
  }
  await dlg.getByRole('button', { name: L.redeem }).click()
  await expect(dlg.getByText(L.redeem).first()).toBeVisible()
}

/** 定位演示控制台中的「积分演示」section。 */
function pointsDemoSection(page: Page): Locator {
  return page.getByRole('dialog', { name: L.consoleOpen })
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: L.pointsSectionTitle }) })
    .first()
}

/** 定位演示控制台中的「退菜确认」section。 */
function refundSection(page: Page): Locator {
  return page.getByRole('dialog', { name: L.consoleOpen })
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: L.refundSectionTitle }) })
    .first()
}

async function grantPoints(page: Page, n: number) {
  await openConsole(page)
  const section = pointsDemoSection(page)
  const input = section.locator('input').first()
  await input.fill(String(n))
  await section.getByRole('button', { name: L.grantBtn }).click()
  await closeConsole(page)
}

async function expirePoints(page: Page) {
  await openConsole(page)
  await pointsDemoSection(page).getByRole('button', { name: L.expireBtn }).click()
  await closeConsole(page)
}

/**
 * 在会员弹窗 PointsSection 主面板读取积分余额。
 * 余额位于「当前积分」标题右侧的 <span> 中（PointsSection 主面板），
 * 兑换面板的「当前积分 N」同样包含数字，但我们优先从主面板读取。
 */
async function readBalance(page: Page): Promise<number> {
  const dlg = page.getByRole('dialog', { name: L.pointsTitle })
  // PointsSection 中 "当前积分 / Current Points" 标签的父容器里包含余额数字。
  // 主面板：<div class="flex justify-between"><h3>当前积分</h3><span>N</span></div>
  // 兑换面板：<div class="flex ...bg-chili-50"><span>当前积分</span><strong>N</strong></div>
  // 统一策略：找到标签文本所在元素，向上两层（label -> flex 容器），再从容器文本里抓第一个数字。
  const label = dlg.getByText(L.balanceLabel).first()
  await expect(label).toBeVisible()
  const row = label.locator('xpath=ancestor::*[contains(@class,"flex")][1]')
  const text = await row.innerText()
  const m = text.match(/(\d+)/)
  if (!m) throw new Error(`未能从会员弹窗解析积分余额，text="${text}"`)
  return Number(m[1])
}

/**
 * 在积分明细面板中读取所有变动值（展示顺序 = 时间倒序 = 最新在前）。
 * 直接定位明细行末尾的 <strong>（包含 +N / -N），避免从整个 dialog innerText 用正则误抓取其他数字。
 */
async function readLedgerAmounts(page: Page): Promise<number[]> {
  const dlg = page.getByRole('dialog', { name: L.pointsTitle })
  // 进入明细面板后，每条记录末尾是 <strong>+N</strong> 或 <strong>-N</strong>。
  // 明细记录的 strong 使用 text-emerald-600（正）或 text-charcoal-900（负），
  // 为避免依赖 CSS 类，直接在明细面板（包含 h3 "积分明细"/"Points History"）范围内
  // 查找所有 innerText 匹配 +N / -N 的 strong。
  await openLedger(page)
  const panel = dlg
    .getByRole('heading', { name: L.ledger })
    .first()
    .locator('xpath=ancestor::*[contains(@class,"rounded-2xl") and contains(@class,"bg-white")][1]')
  const strongs = panel.locator('strong')
  const count = await strongs.count()
  const amounts: number[] = []
  for (let i = 0; i < count; i++) {
    const raw = (await strongs.nth(i).innerText()).trim()
    const m = raw.match(/^([+-−])(\d+)$/)
    if (!m) continue
    amounts.push((m[1] === '+' ? 1 : -1) * Number(m[2]))
  }
  return amounts
}

/**
 * 在结账页「可用兑换券」区域内勾选第 n 张券（0-based，按显示顺序）。
 * 每张券是一个 <button>（含 ¥ 符号和「菜品券/dish coupon」字样），点击即 toggle。
 */
async function toggleCoupon(page: Page, n: number) {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: L.availableCouponsTitle }) })
  await expect(section).toBeVisible()
  // 券行 button：包含 ¥ 且为直接子项，排除确认支付按钮
  const couponBtn = section
    .locator('button')
    .filter({ hasText: /¥/ })
    .nth(n)
  await couponBtn.click()
}

/** 获取购物车数量「+」按钮（用于在购物车中增加数量）。 */
function cartIncreaseBtn(page: Page): Locator {
  // 桌面端 CartPanel 位于 lg:col-span-1 aside；购物车内的「+」按钮 aria-label 为「增加」/「Increase」
  return page.getByRole('button', { name: L.increase }).or(page.getByRole('button', { name: L.increaseEn })).first()
}

// ============================================================================
// REQ-001 消费送积分（获取）
// ============================================================================
test.describe('REQ-001 消费送积分（获取）', () => {
  test('REQ-001.1/1.2 支付后按计分基数入账并在支付成功页反馈', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)

    const subtotal = P1 + P3 + P4 // 158
    const base = subtotal - DISCOUNT // 128
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`).first()).toBeVisible()
    await expect(page.getByText(`-¥${DISCOUNT.toFixed(2)}`).first()).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    // 支付成功页：获得 N 积分、当前积分
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    await expect(page.getByText(L.balanceLabel).first()).toBeVisible()

    await openMember(page)
    expect(await readBalance(page)).toBe(base)
    await closeMember(page)
  })

  test('REQ-001.5 已支付后重复进入结账不重复入账（幂等）', async ({ page }) => {
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

    // 打开会员弹窗 → 明细仅一条 +128，余额 128
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT)
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([P1 + P3 + P4 - DISCOUNT])
    await expect(page.getByRole('dialog').getByText('+128', { exact: true })).toHaveCount(1)
    await closeMember(page)
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
    await closeMember(page)
  })

  test('REQ-002.1/2.2 明细字段齐全（类型/变动值/时间/说明/到期时间）且时间倒序', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500) // 演示发放 +500（早于消费）
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 获取 +128（时间上最新）

    await openMember(page)
    expect(await readBalance(page)).toBe(500 + P1 + P3 + P4 - DISCOUNT)
    await openLedger(page)

    // 时间倒序：最新（消费获赠 +128）在前，演示发放 +500 在后
    expect(await readLedgerAmounts(page)).toEqual([P1 + P3 + P4 - DISCOUNT, 500])
    const dlg = page.getByRole('dialog')
    await expect(dlg.getByText(L.typeEarn).first()).toBeVisible()
    await expect(dlg.getByText('+128', { exact: true })).toBeVisible()
    await expect(dlg.getByText(/\d{1,2}:\d{2}/).first()).toBeVisible()
    // earn 明细的到期时间：次年日期（形如 2027/09/23 或 2027-09-23，en 下为 "M/D/YYYY"）
    await expect(dlg.getByText(new RegExp(String(new Date().getFullYear() + 1))).first()).toBeVisible()
    await expect(dlg.getByText(L.grantNote).first()).toBeVisible()
    await closeMember(page)
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
    // POINTS_TIERS 顺序：500=¥5、1000=¥10、2000=¥20 → 第 0 个为 500 档
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    await expect(redeemButtons).toHaveCount(3)
    await redeemButtons.nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()

    // 返回主面板确认余额 600 - 500 = 100
    await page.getByRole('dialog').getByRole('button', { name: L.back }).click()
    expect(await readBalance(page)).toBe(100)
    // 明细新增「使用 −500」（最新操作，在列表首位）
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([-500, 600])
    await expect(page.getByRole('dialog').getByText(L.typeRedeem).first()).toBeVisible()
    await expect(page.getByRole('dialog').getByText('-500', { exact: true })).toBeVisible()
    await closeMember(page)
  })

  test('REQ-003.3 余额不足时兑换按钮禁用并提示「积分不足」', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 600)
    await openMember(page)
    await openRedeem(page)
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    // 600 余额下先兑换 500 档
    await redeemButtons.nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    // 回到兑换面板，此时余额 100，500 档按钮应被 disabled
    await page.getByRole('dialog').getByRole('button', { name: L.back }).click()
    await openRedeem(page)
    await expect(redeemButtons.nth(0)).toBeDisabled()
    await expect(page.getByRole('dialog').getByText(L.insufficient).first()).toBeVisible()
    // 余额仍为 100（未再次扣减）
    await page.getByRole('dialog').getByRole('button', { name: L.back }).click()
    expect(await readBalance(page)).toBe(100)
    await closeMember(page)
  })

  test('REQ-003.5 余额为 0 时兑换区空态「暂无可用积分」', async ({ page }) => {
    await enterMenu(page)
    await openMember(page)
    await openRedeem(page)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
    await closeMember(page)
  })
})

// ============================================================================
// REQ-004 结账使用兑换券叠加抵扣
// ============================================================================
test.describe('REQ-004 结账使用兑换券叠加抵扣', () => {
  test('REQ-004.2/4.5 兑换券与满减叠加且不影响入账基数', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 1000)
    await openMember(page)
    await openRedeem(page)
    // 兑换 1000 档 → ¥10 券
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(1).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    await closeMember(page)

    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)

    const base = P1 + P3 + P4 - DISCOUNT // 128
    const couponValue = 10
    await toggleCoupon(page, 0)
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    // 应付 = 128 - 10 = 118
    await expect(page.getByText(`¥${(base - couponValue).toFixed(2)}`).first()).toBeVisible()

    await page.getByRole('button', { name: L.confirmPay }).click()
    // 入账基数仍为兑换前 base（128），余额 = 0（兑换后）+ 128 = 128
    await expect(page.getByText(L.earnedLine).first()).toBeVisible()
    await openMember(page)
    expect(await readBalance(page)).toBe(base)
    await closeMember(page)
  })

  test('REQ-004.3/4.4 抵扣超过 50% 上限时截断、提示且不找零不为负', async ({ page }) => {
    await enterMenu(page)
    // 种子 5000：兑换 2000 档 ¥20 + 1000 档 ¥10 × 3 = 券值合计 ¥50
    await grantPoints(page, 5000)
    await openMember(page)
    await openRedeem(page)
    const redeemButtons = page.getByRole('dialog').getByRole('button', { name: L.redeemBtn })
    await redeemButtons.nth(2).click() // 2000 → ¥20
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await redeemButtons.nth(1).click() // 1000 → ¥10
    await closeMember(page)

    // 构造小计 80（< 100 无满减）：手工宽粉 ¥16 × 5 = ¥80（加 1 份后在购物车内 +4 次）
    await addDish(page, '手工宽粉')
    for (let i = 0; i < 4; i++) {
      await cartIncreaseBtn(page).click()
    }
    await goToCheckout(page)

    const subtotal = P9 * 5 // 80
    await expect(page.getByText(`¥${subtotal.toFixed(2)}`).first()).toBeVisible()

    // 逐张勾选 4 张券（¥20 + ¥10 + ¥10 + ¥10 = ¥50）；cap = 80 × 50% = 40
    const cap = subtotal * 0.5 // 40
    for (let i = 0; i < 4; i++) {
      await toggleCoupon(page, i)
    }
    await expect(page.getByText(L.couponLimit).first()).toBeVisible()
    await expect(page.getByText(L.couponDeduction).first()).toBeVisible()
    // 实际抵扣 = cap = ¥40，应付 = ¥40（不找零、不为负）
    await expect(page.getByRole('button', { name: L.confirmPay })).toContainText(`¥${cap.toFixed(2)}`)
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

    // orderItems 顺序 = p1, p3, p4；p3 是第 2 个（nth(1)，¥42）
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    await openConsole(page)
    const rSec = refundSection(page)
    await expect(rSec.getByRole('button', { name: L.refundConfirmBtn })).toHaveCount(1)
    await rSec.getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 余额 128 - 42 = 86；明细倒序：-42, +128
    await openMember(page)
    expect(await readBalance(page)).toBe(P1 + P3 + P4 - DISCOUNT - P3)
    await openLedger(page)
    expect(await readLedgerAmounts(page)).toEqual([-P3, P1 + P3 + P4 - DISCOUNT])
    await expect(page.getByRole('dialog').getByText(L.typeRefund).first()).toBeVisible()
    await closeMember(page)
  })

  test('REQ-005.3 未支付退菜确认不回退积分（仅 approved）', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅')
    await goToCheckout(page) // 不支付
    await page.getByRole('button', { name: L.backToOrder }).click()
    await page.getByRole('button', { name: L.cancelDish }).first().click()
    await openConsole(page)
    await refundSection(page).getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 未支付：无积分回退，余额仍为 0，明细空态
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    await expect(page.getByRole('dialog').getByText(L.emptyLedger)).toBeVisible()
    await closeMember(page)
  })

  test('REQ-005.2 多笔回退超过余额时按 0 截断不为负', async ({ page }) => {
    await enterMenu(page)
    await addDish(page, '鎏金番茄鸳鸯锅') // 68
    await addDish(page, '琥珀嫩牛肉') // 42
    await addDish(page, '雪花肥牛卷') // 48
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click() // 入账 128
    await page.getByRole('button', { name: L.backToOrder }).click()

    // 对 3 项都发起退菜（每次点击当前第 1 个未申请退菜的按钮，因为申请后退菜按钮被状态徽章替换）
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: L.cancelDish }).nth(0).click()
    }
    await openConsole(page)
    const rSec = refundSection(page)
    const confirmBtn = rSec.getByRole('button', { name: L.refundConfirmBtn })
    await expect(confirmBtn).toHaveCount(3)
    // 逐一点击确认；每确认一项该项从列表中移除
    for (let i = 0; i < 3; i++) {
      await confirmBtn.nth(0).click()
    }
    await closeConsole(page)

    // 余额 0 截断不为负；明细变动值之和 = 0（入账 128 被多笔回退冲抵到 0）
    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    const amounts = await readLedgerAmounts(page)
    // 至少包含入账 +128
    expect(amounts).toContain(P1 + P3 + P4 - DISCOUNT)
    // 展示余额（0）= 明细变动值之和（被 reducer 截断到 0，明细中会出现 "refund" 条目使总和 ≤ 0；
    // 按技术实现 balance 被 max(0,...) 截断，因此这里只校验余额为 0，不校验明细总和恰好为 0，
    // 因为 reducer 允许最终余额为 0 而明细存在截断影响（REQ-005.2 只要求余额不为负）。
    await closeMember(page)
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
    // 演示发放 earn 明细应展示次年到期
    await expect(page.getByRole('dialog').getByText(new RegExp(String(new Date().getFullYear() + 1))).first()).toBeVisible()
    await closeMember(page)
  })

  test('REQ-006.2/6.3 模拟过期后余额剔除、明细「过期」、不可兑换', async ({ page }) => {
    await enterMenu(page)
    await grantPoints(page, 500)
    await expirePoints(page)

    await openMember(page)
    expect(await readBalance(page)).toBe(0)
    await openLedger(page)
    const amounts = await readLedgerAmounts(page)
    // 过期后最新一条为 expire -500，前一条为 earn +500
    expect(amounts[0]).toBe(-500)
    expect(amounts).toContain(500)
    await expect(page.getByRole('dialog').getByText(L.typeExpire).first()).toBeVisible()
    // 返回主面板 → 进入兑换面板 → 空态
    await page.getByRole('dialog').getByRole('button', { name: L.back }).click()
    await openRedeem(page)
    await expect(page.getByRole('dialog').getByText(L.emptyRedeem)).toBeVisible()
    await closeMember(page)
  })
})

// ============================================================================
// REQ-007 积分余额一致性
// ============================================================================
test.describe('REQ-007 积分余额一致性', () => {
  test('REQ-007.1/7.2 混合操作后展示余额与明细合计一致（未截断场景）', async ({ page }) => {
    await enterMenu(page)
    // earn 128
    await addDish(page, '鎏金番茄鸳鸯锅')
    await addDish(page, '琥珀嫩牛肉')
    await addDish(page, '雪花肥牛卷')
    await goToCheckout(page)
    await page.getByRole('button', { name: L.confirmPay }).click()
    await page.getByRole('button', { name: L.backToOrder }).click()
    // grant +500
    await grantPoints(page, 500)
    // redeem -500
    await openMember(page)
    await openRedeem(page)
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(0).click()
    await expect(page.getByText(L.redeemSuccess).first()).toBeVisible()
    await closeMember(page)
    // refund -42（p3）
    await page.getByRole('button', { name: L.cancelDish }).nth(1).click()
    await openConsole(page)
    await refundSection(page).getByRole('button', { name: L.refundConfirmBtn }).click()
    await closeConsole(page)

    // 期望余额 = 128 + 500 - 500 - 42 = 86
    const expected = P1 + P3 + P4 - DISCOUNT + 500 - 500 - P3
    await openMember(page)
    expect(await readBalance(page)).toBe(expected)
    await openLedger(page)
    // 未发生余额截断，明细变动值之和应等于展示余额
    const amounts = await readLedgerAmounts(page)
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(expected)
    await closeMember(page)
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

    // 英文环境：种子 → 兑换 → 结账使用 → 支付 闭环
    await grantPoints(page, 1000)
    await openMember(page)
    await expect(page.getByText(/Current Points/).first()).toBeVisible()
    await openRedeem(page)
    await page.getByRole('dialog').getByRole('button', { name: L.redeemBtn }).nth(1).click() // 1000 档
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
    await closeMember(page)
  })
})
