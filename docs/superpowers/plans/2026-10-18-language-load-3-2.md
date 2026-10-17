# 3-2 按语言异步加载实施计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按任务实施；仅对真实异步、兼容和状态保持风险补回归。

**Goal:** 完成 Vben 风格的整语言异步加载，模板预算参考调整为 500KiB report-only，通过验证并合并本地 master，再由后续业务统一阶段同步。

**Architecture:** 每 app 保留一个显式 i18n/runtime owner。现有 appLoaders 保持兼容，增加 appNamespaces + loadMessages 的整语言入口；所有注册资源在启动/切换时完整准备，不增加页面门槛。保留公共同步中文 fallback、组件身份与偏好面板。

**Tech Stack:** React、TypeScript、i18next、现有 locale runtime、Vite、Vitest、pnpm/Turbo；无新依赖。

**Spec:** FlowDesk Task「NiuBu Web 模板 3-2 翻译按需加载与首屏体积」的设计 v2 与 2026-10-18 最新持续目标授权；最新授权覆盖原等待确认/业务不动阶段限制。

## Global Constraints

- 先完成并合并模板 3-2，再同步与整理业务仓；全部本地，不推送、不发布。
- 500KiB = 512,000 字节，只报告不拦截；保留 gzip6、真实首屏闭包、具名语言成功/失败变体和去重 union、CSS单列。
- 不做页面级文案加载门槛、namespace需求租约、偏好面板代码lazy或公共fallback切片，不加工演示数据，不为预算过度优化。
- 旧 appLoaders/eager 与公共/standalone 同步显示兼容；keys/插值和静态全目录locale检查保持。
- 语言切换保留页面/表单dirty与pending、Query、树表展开/列宽、overlay session和焦点；只允许最新一代提交语言及提示。
- 不安装新依赖、不新增或运行自动E2E；必要本地预览/正常浏览器检查已获持续目标授权。
- 证据只放 ignored `.superpowers/sdd/2026-10-18-final-unification/`，结论回原Task/Case。

## Review Focus

1. 首次英文启动不静态带全量 app 中文；中文兼容公共资源按实际保留，统计不删真实首屏成员。
2. 新整语言入口缺失namespace、公共覆盖或非法字典不能半成功；失败可重试。
3. 同语言并发请求去重，快速切换和dispose不提交迟到值或过时localeError。
4. 启动英文失败后的中文回退和二次失败保持现有可恢复行为；不自动刷新丢草稿。
5. 切换只更新翻译与DOM lang，不卸载表单、树表或偏好面板，不重写业务状态机。

## Task 1：公共整语言入口

**Files:** `packages/locales/src/instance.ts`、必要同目录加载适配模块/测试、`index.ts`；若确有原runtime兼容缺陷，限定修改 `packages/effects/hooks/src/locale.ts` 及回归并说明。

**Interfaces:** `createI18n` 保留旧 `{appLoaders,defaultLocale,domTarget}`；新增与其互斥的 `{appNamespaces: readonly string[], loadMessages(locale: Locale, signal: AbortSignal): Promise<Readonly<Record<string, Resource>>>, defaultLocale, domTarget}`。AppI18n现有requiredNamespaces/changeLocale/ensureNamespaces/t/dispose接口保持。

- [x] 补真实失败回归：完整语言加载/安装、旧eager兼容、同语言并发去重、资源完整性/公共namespace拒绝、失败重试、过期/取消/销毁隔离；先观察RED。
- [x] 实现整语言资源适配，继续由原runtime做原子准备与最新代提交；缓存成功语言结果，失败不污染，app不能覆盖公共namespace。
- [x] 运行 locales 与相关 hooks 定向测试、typecheck/lint，提交独立公共能力；提供原始RED/GREEN、文件与限制说明。

## Task 2：Playground接入与预算

**Files:** `apps/playground/src/locales/index.ts` 及相关测试、`main.tsx` 与既有启动/语言集成测试；`apps/playground/vite.config.ts`；`internal/scripts/src/budget.ts` 及现有期望；`docs/guide/engineering-deploy.md`。

**Interfaces:** 消费Task1的appNamespaces/loadMessages；保留app namespace与双语app.json、现有language preference写入及全部页面。

- [x] 新加载入口仅动态导入所选完整app语言资源，传递取消信号检查；不拆页面namespace，不引入语言页面gate。
- [x] 应用启动/语言提示以最新操作为准，过时then/catch不得覆盖新提示；覆盖英文失败中文回退、输入dirty/表格与焦点保留的真实流程。
- [x] 参考常量与既有测试/工程说明改为512000，report-only不变；保留真实首屏统计和历史报告，不把阈值变化称实际减载。
- [x] 定向回归/type/lint/locale检查后完成默认增量check/format，保存真实before/after构建与预算，按公共/工具/app职责分提交。

## Task 3：独审、浏览器与模板合并

- [x] 独立审查公共与应用组合差量，修复影响使用/兼容/状态保持的问题并复核。
- [x] 使用本地Playground实际操作语言切换、失败恢复相关可测场景、表单/树表/弹层；不新增自动E2E脚本。
- [ ] 两默认检查通过后合并模板本地master，保留远端不动；更新Task/Case的真实状态和恢复入口。
- [ ] 进入业务同步与逐模块统一阶段，保291路由/67菜单、双线完整与请求disabled；该阶段另在业务仓记录执行计划。
