# 探索性测试执行脚本 v1.1

## 依赖
- Python 3.10+；`pip install playwright` 后 `playwright install chromium`（或使用系统自带 /opt/chromium.org/chromium/chrome，PLAYWRIGHT_CHROMIUM_PATH 覆盖）；
- Node 环境：非必需（et_* 均为 Python）。

## 脚本清单

| 脚本 | 角色 | 作用 |
| --- | --- | --- |
| et_static_expected.py | Planner | TSX → E_expected 基线 |
| et_enumerate.py | Planner | 访问站点逐视图枚举 E_actual |
| et_runner.py | Executor | 启动浏览器 + 注入监听，人/Agent 自由探索，落盘 visited/console |
| **et_monitor.py** | **Monitor** | **只读并行观察进程：订阅 console/error、每步对账 expected、自动截图、打 alerts** |
| et_diff.py | Reviewer | 计算 S/V/C，输出 coverage.md/json |
| et_run_all.sh | 入口 | S+/X 两模式一键串起全流程 |

## S+ 模式快速开始
```bash
./et_run_all.sh https://<url> <repo_root> et-YYYYMMDD-xxx headful
# 第一次会生成 reports/<sid>/charter.json 模板
# 编辑后重跑，Monitor 会自动在后台并行启动
```

## X 模式（红蓝对抗）
```bash
./et_run_all.sh https://<url> <repo_root> et-YYYYMMDD-xxx-X headful --x
# 产出 _a 和 _b 两份 visited/console/alerts，et_diff 自动合并
```

## Monitor 启动细节
et_monitor.py 默认用新浏览器打开 url 做只读观察；如需 attach 到 Executor 已有浏览器，用 `--cdp http://127.0.0.1:<port>`（需要 Executor 启动时开 `--remote-debugging-port`）。在 et_run_all.sh 的简化实现中，Monitor 独立开浏览器访问同一 URL——对无状态/内存态站点的 console/路由/截图观察够用；对需要"观察同一个页面上的同一点击"的场景，请用 CDP attach 模式。
