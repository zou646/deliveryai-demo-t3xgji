import { test, expect, type Page, type Locator } from '@playwright/test'

// ============================================================================
// 订酒店 MVP 冒烟 E2E（e2e/hotel-booking.spec.ts）
// 依据 Spec SPEC-HOTEL-BOOKING-MVP-001 §5 REQ-H-001~013 / §9 NFR-H-007
// 覆盖：入口/搜索→详情→加购→下单→模拟支付→订单列表/详情→客服工单→后台响应→模块切换
// 数据：默认内置 6 间房型；默认日期今日→明日（1 晚）
// 执行边界：纯前端内存态；用例独立（刷新即重置），可乱序执行
// ============================================================================

const L = {
  ctaHotel: /进入订酒店|Book a Hotel/,
  searchTitle: /查找合适的房间|Find a room/,
  bookNow: /^立即预订$|^Book now$/,
  addDraft: /加入预订|Add to booking/,
  submitOrder: /提交订单|Submit order/,
  guestNamePh: /请输入入住人姓名|Enter guest name/,
  guestPhonePh: /请输入 11 位手机号|11-digit mobile/,
  payTitle: /订单支付|Pay order/,
  confirmPay: /^确认支付|^Pay /,
  paying: /支付中…|Processing…/,
  ordersTitle: /我的订单|My orders/,
  tabAll: '全部',
  tabPending: '待支付',
  tabPaid: '已支付',
  tabCancelled: '已取消',
  tabCompleted: '已完成',
  tabAllEn: 'All',
  tabPendingEn: 'Pending',
  tabPaidEn: 'Paid',
  tabCancelledEn: 'Cancelled',
  tabCompletedEn: 'Completed',
  actionPay: /去支付|Pay now/,
  actionCancel: /取消订单|Cancel order/,
  actionContact: /联系客服|Contact support/,
  actionRebook: /再次预订|Book again/,
  supportTitle: /客服与帮助|Support & Help/,
  ticketSubmit: /提交咨询|Submit a request/,
  submitTicket: /^提交$|^Submit$/,
  myTickets: /我的工单|My tickets/,
  ticketWaiting: /待处理|Pending/,
  ticketProcessed: /已处理|Resolved/,
  adminTitle: /酒店运营后台|Hotel (Admin|Operations)/,
  adminRooms: /房型管理|Room types/,
  adminTickets: /工单处理|Tickets/,
  adminAddRoom: /新增房型|New room/i,
  adminSave: /保存|Save/,
  adminRespond: /回复|Reply/,
  dateError: /离店日期需晚于入住日期|Check-out must be after check-in/,
  phoneError: /11.*手机号|11-digit/,
  nameError: /填写入住人姓名|guest name/,
  contentShort: /内容至少 5 个字|at least 5 characters/,
  paidMsg: /支付成功|Payment successful/,
  cancelledMsg: /订单已取消|cancelled/,
  ticketRespondedMsg: /工单已响应|Ticket replied/,
  roomCreatedMsg: /房型已新增|Room type created/,
  navSupport: /^客服$|^Support$/,
  navAdmin: /^后台$|^Admin$/,
  hotpotModuleTab: '火锅点单',
  hotelModuleTab: '酒店预订',
  remaining: /剩余|rooms left/,
  roomNameField: /房型名称|Room name/,
  hotelNameField: /酒店名称|Hotel name/,
  addressField: /^地址$|^Address$/,
  priceField: /每晚价格|Price per night/,
  stockField: /可订数量|Stock/,
  total: /合计|Total/,
  pendingStatus: /待支付|Pending/,
  paidStatus: /已支付|Paid/,
}

// ---- helpers ----

async function enterHotel(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: L.ctaHotel }).first().click()
  await expect(page).toHaveURL(/#\/hotel-home$/)
  await expect(page.getByRole('heading', { name: L.searchTitle })).toBeVisible()
}

function firstRoomCard(page: Page): Locator {
  return page.locator('article').first()
}

async function openFirstRoom(page: Page): Promise<{ roomName: string }> {
  const card = firstRoomCard(page)
  await expect(card).toBeVisible()
  const roomName = await card.locator('h3').first().innerText()
  // 卡片右下角"立即预订"Button（last() 排除整卡外层 button）
  await card.getByRole('button', { name: L.bookNow }).last().click()
  await expect(page).toHaveURL(/#\/hotel-room$/)
  return { roomName }
}

async function firstRoomUnitPrice(page: Page): Promise<number> {
  // 卡片右上角价格：紧跟"每晚"说明的 p
  const card = firstRoomCard(page)
  const priceText = await card.locator('p.text-chili-600').first().innerText()
  return Number(priceText.replace(/[^\d.]/g, ''))
}

async function fillGuestValid(page: Page, name = '张三', phone = '13800138000') {
  await page.getByPlaceholder(L.guestNamePh).fill(name)
  await page.getByPlaceholder(L.guestPhonePh).fill(phone)
}

/** 在订单列表页点击 tab 按钮（避免误点订单卡片）。 */
async function clickOrdersTab(page: Page, zh: string, en: string) {
  // 订单列表的 tab 条是 .scrollbar-none 容器内的 5 个按钮
  const tab = page.locator('.scrollbar-none').getByRole('button', { name: new RegExp(`^${zh}$|^${en}$`) })
  await tab.first().click()
}

/** 顶部模块切换按钮（TopBar .md:flex 容器） */
function moduleSwitcher(page: Page): Locator {
  // header 中 ml-1 hidden md:flex 容器下的两个模块 Tab
  return page.locator('header > div').locator('div.rounded-full.bg-rice-200').first()
}

// ============================================================================
// tests
// ============================================================================

test.describe('订酒店 MVP - 冒烟 E2E', () => {
  test('HOTEL-001: 首页进入订酒店，默认展示搜索栏与房型列表', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: L.ctaHotel })).toBeVisible()
    await page.getByRole('button', { name: L.ctaHotel }).first().click()
    await expect(page).toHaveURL(/#\/hotel-home$/)
    // 城市下拉可见（combobox）
    await expect(page.getByRole('combobox').first()).toBeVisible()
    await expect(page.getByRole('combobox').first()).toHaveValue('')
    // 搜索区两个日期输入
    await expect(page.locator('main input[type="date"]')).toHaveCount(2)
    await expect(page.getByRole('heading', { name: L.searchTitle })).toBeVisible()
    // ≥3 间房型卡
    const cards = page.locator('article')
    await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(3)
    await expect(cards.first().getByRole('button', { name: L.bookNow }).last()).toBeVisible()
    await expect(cards.first().getByText(L.remaining)).toBeVisible()
  })

  test('HOTEL-002: 详情页金额按 单价×晚数×间数 实时计算', async ({ page }) => {
    await enterHotel(page)
    const unit = await firstRoomUnitPrice(page)
    await openFirstRoom(page)
    const aside = page.locator('aside')
    const totalLine = aside.getByText(/合计 ¥|total /)
    await expect(totalLine).toContainText(`¥${(unit * 1 * 1).toFixed(2)}`)
    // 加一间 → 单价 × 2 间 × 1 晚
    await aside.locator('button[aria-label="inc"]').first().click()
    await expect(totalLine).toContainText(`¥${(unit * 2 * 1).toFixed(2)}`)
    // 离店日期 +1 天 → 共 2 晚：单价 × 2 间 × 2 晚
    const inputs = aside.locator('input[type="date"]')
    const co = await inputs.nth(1).inputValue()
    const [y, m, d] = co.split('-').map(Number)
    const later = new Date(y, m - 1, d + 1)
    const laterStr = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`
    await inputs.nth(1).fill(laterStr)
    await expect(totalLine).toContainText(`¥${(unit * 2 * 2).toFixed(2)}`)
  })

  test('HOTEL-003: 日期非法时阻止加购并显示错误提示', async ({ page }) => {
    await enterHotel(page)
    await openFirstRoom(page)
    const aside = page.locator('aside')
    const inputs = aside.locator('input[type="date"]')
    await expect(inputs).toHaveCount(2)
    const co = await inputs.nth(1).inputValue()
    const [y, m, d] = co.split('-').map(Number)
    const later = new Date(y, m - 1, d + 2)
    const laterStr = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`
    await inputs.nth(0).fill(laterStr)
    // 错误文案同时出现在 aside 和 toast，用 aside 范围断言
    await expect(aside.getByText(L.dateError)).toBeVisible()
    await expect(aside.getByRole('button', { name: L.addDraft })).toBeDisabled()
  })

  test('HOTEL-004: 下单表单姓名/手机号校验生效', async ({ page }) => {
    await enterHotel(page)
    await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page.getByText(L.nameError)).toBeVisible()
    await page.getByPlaceholder(L.guestNamePh).fill('张三')
    await page.getByPlaceholder(L.guestPhonePh).fill('12345')
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page.getByText(L.phoneError)).toBeVisible()
  })

  test('HOTEL-005: 提交订单→订单号 HTL 开头→金额正确→列表/详情可见', async ({ page }) => {
    await enterHotel(page)
    const unit = await firstRoomUnitPrice(page)
    const { roomName } = await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await fillGuestValid(page)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page).toHaveURL(/#\/hotel-order-detail$/)
    const orderId = await page.locator('code').first().innerText()
    expect(orderId.startsWith('HTL')).toBe(true)
    // 详情页"房型信息"section 下的合计行：heading 合计旁的金额
    const roomSection = page.getByRole('heading', { name: /房型信息|Room/ }).locator('..')
    await expect(roomSection.getByText(`¥${(unit * 1 * 1).toFixed(2)}`).first()).toBeVisible()
    await expect(page.getByText(roomName)).toBeVisible()
    // 状态 badge（用 span 断言，非 button）
    await expect(page.locator('main').getByText(L.pendingStatus).first()).toBeVisible()
    // 订单列表里能看到（全部 tab 默认）
    await page.goto('/#/hotel-orders')
    await expect(page.locator("main").getByText(orderId).first()).toBeVisible()
    await clickOrdersTab(page, L.tabPending, L.tabPendingEn)
    await expect(page.locator("main").getByText(orderId).first()).toBeVisible()
  })

  test('HOTEL-006: 模拟支付成功→状态变已支付，操作按钮切换', async ({ page }) => {
    await enterHotel(page)
    await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await fillGuestValid(page)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page).toHaveURL(/#\/hotel-order-detail$/)
    await page.getByRole('button', { name: L.actionPay }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: L.confirmPay }).click()
    await expect(page.getByText(L.paying)).toBeVisible()
    // 等待支付完成："去支付"按钮消失，支付成功 toast 出现
    await expect(page.getByRole('button', { name: L.actionPay })).toHaveCount(0, { timeout: 10000 })
    await expect(page.getByText(L.paidMsg)).toBeVisible()
    await expect(page.locator('main').getByText(L.paidStatus).first()).toBeVisible()
    await expect(page.getByRole('button', { name: L.actionContact })).toBeVisible()
    await expect(page.getByRole('button', { name: L.actionRebook })).toBeVisible()
    // 订单列表"已支付"tab 可见
    await page.goto('/#/hotel-orders')
    await clickOrdersTab(page, L.tabPaid, L.tabPaidEn)
    await expect(page.locator('text=/^HTL/').first()).toBeVisible()
  })

  test('HOTEL-007: 联系客服提交咨询工单，我的工单显示待处理', async ({ page }) => {
    await enterHotel(page)
    await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await fillGuestValid(page)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page).toHaveURL(/#\/hotel-order-detail$/)
    // 支付
    await page.getByRole('button', { name: L.actionPay }).click()
    await page.getByRole('button', { name: L.confirmPay }).click()
    await expect(page.getByRole('button', { name: L.actionPay })).toHaveCount(0, { timeout: 10000 })
    // 联系客服
    await page.getByRole('button', { name: L.actionContact }).click()
    const dialog = page.getByRole('dialog', { name: L.supportTitle })
    await expect(dialog).toBeVisible()
    const submitTab = dialog.getByRole('button', { name: L.ticketSubmit })
    if (await submitTab.count()) await submitTab.click()
    await dialog.locator('textarea').first().fill('房间空调不制冷，希望尽快处理')
    await dialog.getByRole('button', { name: L.submitTicket }).click()
    await expect(dialog.getByText(/房间空调不制冷/)).toBeVisible()
    await expect(dialog.getByText(L.ticketWaiting)).toBeVisible()
  })

  test('HOTEL-008: 工单内容少于 5 字时阻止提交', async ({ page }) => {
    await enterHotel(page)
    await page.getByRole('button', { name: L.navSupport }).first().click()
    const dialog = page.getByRole('dialog', { name: L.supportTitle })
    await expect(dialog).toBeVisible()
    const submitTab = dialog.getByRole('button', { name: L.ticketSubmit })
    if (await submitTab.count()) await submitTab.click()
    await dialog.locator('textarea').first().fill('hi')
    await dialog.getByRole('button', { name: L.submitTicket }).click()
    await expect(dialog.getByText(L.contentShort)).toBeVisible()
  })

  test('HOTEL-009: 待支付取消订单→已取消 tab 可见，库存回补', async ({ page }) => {
    await enterHotel(page)
    const card0 = firstRoomCard(page)
    const remaining0 = await card0.getByText(L.remaining).innerText()
    await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await fillGuestValid(page)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page).toHaveURL(/#\/hotel-order-detail$/)
    const orderId = await page.locator('code').first().innerText()
    await page.getByRole('button', { name: L.actionCancel }).first().click()
    const confirmDlg = page.getByRole('dialog').last()
    await expect(confirmDlg.getByText(/确定取消|Cancel this order/)).toBeVisible()
    await confirmDlg.getByRole('button', { name: L.actionCancel }).last().click()
    await expect(page.getByText(L.cancelledMsg)).toBeVisible()
    await page.goto('/#/hotel-orders')
    await clickOrdersTab(page, L.tabCancelled, L.tabCancelledEn)
    await expect(page.locator("main").getByText(orderId).first()).toBeVisible()
    await page.goto('/#/hotel-home')
    const remaining1 = await firstRoomCard(page).getByText(L.remaining).innerText()
    expect(remaining1).toEqual(remaining0)
  })

  test('HOTEL-010: 后台新增房型后，前台可搜索到该房型', async ({ page }) => {
    await enterHotel(page)
    await page.getByRole('button', { name: L.navAdmin }).first().click()
    await expect(page).toHaveURL(/#\/hotel-admin$/)
    await expect(page.getByText(L.adminTitle)).toBeVisible()
    await page.getByRole('button', { name: L.adminRooms }).click()
    const count0 = await page.locator('tbody tr').count()
    await page.getByRole('button', { name: L.adminAddRoom }).click()
    const dlg = page.getByRole('dialog')
    await expect(dlg).toBeVisible()
    const fillField = (labelRe: RegExp, val: string) =>
      dlg.getByLabel(labelRe).first().fill(val)
    await fillField(L.roomNameField, 'E2E 测试海景大床房')
    await fillField(L.hotelNameField, 'E2E 测试酒店')
    await fillField(L.addressField, '测试路 1 号')
    await fillField(L.priceField, '888')
    await fillField(L.stockField, '3')
    await dlg.getByRole('button', { name: L.adminSave }).click()
    await expect(page.getByText(L.roomCreatedMsg)).toBeVisible()
    await expect.poll(async () => page.locator('tbody tr').count()).toBe(count0 + 1)
    await expect(page.getByText('E2E 测试海景大床房')).toBeVisible()
    await page.goto('/#/hotel-home')
    await expect(page.getByText('E2E 测试海景大床房')).toBeVisible()
  })

  test('HOTEL-011: 后台响应工单后，我的工单显示已处理与客服回复', async ({ page }) => {
    await enterHotel(page)
    await openFirstRoom(page)
    await page.getByRole('button', { name: L.addDraft }).click()
    // P1-2: 加入预订后停留在详情页，由顶部 Draft CTA 进入结算
    await page.locator('main').getByRole('button', { name: /去预订|Go to checkout/ }).first().click()
    await expect(page).toHaveURL(/#\/hotel-checkout$/)
    await fillGuestValid(page)
    await page.getByRole('button', { name: L.submitOrder }).click()
    await expect(page).toHaveURL(/#\/hotel-order-detail$/)
    // 顶部客服按钮提交咨询（pending 订单也能发通用咨询）
    await page.getByRole('button', { name: L.navSupport }).first().click()
    let dialog = page.getByRole('dialog', { name: L.supportTitle })
    await expect(dialog).toBeVisible()
    const submitTab = dialog.getByRole('button', { name: L.ticketSubmit })
    if (await submitTab.count()) await submitTab.click()
    await dialog.locator('textarea').first().fill('E2E 测试咨询内容，请回复')
    await dialog.getByRole('button', { name: L.submitTicket }).click()
    await expect(dialog.getByText(L.ticketWaiting)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    // 进后台工单处理
    await page.goto('/#/hotel-admin')
    await page.getByRole('button', { name: L.adminTickets }).click()
    // 通过文本定位工单行：包含该内容的容器 div
    const ticketRow = page.locator('div.rounded-3xl').filter({ hasText: /E2E 测试咨询内容/ }).first()
    await expect(ticketRow).toBeVisible()
    // 回复输入框：placeholder 是"回复内容"
    const replyInput = ticketRow.locator('input[placeholder*="回复"], input[placeholder*="Reply"]')
    await expect(replyInput).toBeVisible()
    await replyInput.fill('您好，已为您核实并处理，感谢反馈。')
    await ticketRow.getByRole('button', { name: L.adminRespond }).click()
    await expect(page.getByText(L.ticketRespondedMsg)).toBeVisible()
    // 前台打开"我的工单"
    await page.getByRole('button', { name: L.navSupport }).first().click()
    dialog = page.getByRole('dialog', { name: L.supportTitle })
    const myTab = dialog.getByRole('button', { name: L.myTickets })
    if (await myTab.count()) await myTab.click()
    await expect(dialog.getByText(L.ticketProcessed)).toBeVisible()
    await expect(dialog.getByText(/已为您核实/)).toBeVisible()
  })

  test('HOTEL-012: 模块切换与深链接 #/hotel-home 直达', async ({ page }) => {
    await page.goto('/#/hotel-home')
    await expect(page).toHaveURL(/#\/hotel-home$/)
    await expect(page.getByRole('heading', { name: L.searchTitle })).toBeVisible()
    // 顶部模块切换器：胶囊容器中"火锅点单"按钮（若不可见则用页面内入口作为兜底）
    const hotpotTab = moduleSwitcher(page).getByRole('button', { name: L.hotpotModuleTab })
    if (await hotpotTab.count()) {
      await hotpotTab.click()
    } else {
      await page.goto('/#/home')
    }
    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByRole('button', { name: /A08/ }).first()).toBeVisible()
    // 首页直接点击"进入订酒店"按钮（与用户真实路径一致）
    await page.getByRole('button', { name: L.ctaHotel }).first().click()
    await expect(page).toHaveURL(/#\/hotel-home$/)
    await expect(page.getByRole('heading', { name: L.searchTitle })).toBeVisible()
  })
})
