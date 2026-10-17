# 第三轮 3-1 Tailwind 迁移执行计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development；各写集独立实施，主控集成和验收。复用现有测试，对控件接入、样式生成与偏好等真实风险增加必要行为验证。

**Goal:** 在模板仓完成已批准的 3-1 迁移，形成可供用户视觉验收的登录、组件、CRUD 与外框；业务仓暂不同步。

**Architecture:** 保留公开组件接口、class/data 钩子与 CSS exports。普通声明归入组件 Tailwind 类；复杂几何、动态变量、动画及真实业务 class 消费继续使用所属包 CSS。优先修正源码扫描和基础控件样式归属，再迁上层组件与 app。

**Tech Stack:** React、TypeScript、Tailwind 4、shadcn/Radix、Vite、Vitest、pnpm/Turbo；使用现有依赖。

**Spec:** FlowDesk `Tasks/NiuBu Web 模板 3-1 样式统一迁移到 Tailwind.md` 的「迁移方案 v1（已确认）」；用户 2026-10-17 明确批准实施。完整方案与确认原话由 TaskNotes 保存。

## Global Constraints

- 仅改模板仓。业务仓同步须再经用户确认；不推送、不新增或运行 E2E、不安装依赖、不自行启动预览服务。
- 用户本轮补充要求将自己在业务仓 `.gitignore` 新增的 `.DS_Store` 一并处理：该单行整理单独本地提交，不构成模板能力同步。
- 基线 `da2d0d3`，在 `codex/tailwind-migration-3-1` 功能分支实施。公共包与 Playground 分开提交。
- 保留既有主题/密度/字号/圆角、7 布局/15 主题、document 主滚动、认证/权限/Query/overlay owner 行为。
- 保留业务消费的 class/data/父子结构和公开 CSS exports。不能仅保留空 class 而删除业务仍使用的声明。
- 不改 3-2 翻译契约、23 项能力缺口、请求协议、路由和业务状态机。
- 验证默认 `pnpm check`、`pnpm format:check`，保留缓存；记录真实预算，不改阈值或策略。
- 视觉由用户验收；自动检查不代签。用户视觉确认前不以已验收名义合并 master，Task 保持未完成。
- 过程证据只放忽略的 `.superpowers/`；不新增仓库验证/交付报告。
- 子 Agent 排除 `gpt-6-astra`；具体 model/effort 在派发前按工作选型。

## Review Focus

1. 没有 common-ui CSS 的基础控件仍具有完整外观；portal、键盘、disabled 和表单关联不变。
2. `source(none)` 下组件工具类进入实际构建，测试源码不污染产物；不能只断言 TSX class 字符串。
3. 兼容 CSS 与 utilities 的级联不会让偏好、密度、业务自用 class 失效；不依赖 `!important`。
4. 原生控件替换后 ref/id、空值、数字草稿、checkbox 状态、取消和 focus 行为保留。
5. 半暗区域、document 滚动、页签特殊形状及精确断点不被通用工具类覆盖。

## Task 0：扫描与兼容基线（主控）

**Files:** `apps/playground/src/styles/index.css`、相关实际 CSS 构建验证；必要时 `packages/styles/src/tokens.template.css` 和生成链。

**Interfaces:** 消费现有源码路径、语义变量与 CSS exports；不增加运行时 API。

- [x] 保留原分支和业务未跟踪文件，运行默认增量基线检查并保存日志。
- [x] 显式扫描 common-ui、shadcn、layout/menu/tabs、layouts 和 app 生产目录，排除测试。
- [x] 用实际 Vite/Tailwind 构建验证遗漏目录的 utility 生成，不能仅检索 source 配置。
- [x] 列出必须保留的兼容规则；普通 fallback 如需与 utility 并存，用已声明的 components layer 控制优先级，不增加全局重要性。

## Task 1：shadcn 与偏好控件（独立写集 A）

**Files:** `packages/@core/ui-kit/shadcn-ui/src/{switch,select,slider,tooltip}.tsx` 及必要既有控件；`packages/effects/common-ui/src/{preferences,display-preferences}/`。

**Interfaces:** 现有 exports/props、Radix 状态和 portal owner 不变；控制器/偏好 schema 不变。

- [x] 先核现有控件/偏好行为测试，补能抓住失去独立样式或事件适配的必要回归。
- [x] 将 primitive 视觉归回自身 Tailwind；迁偏好容器、选择卡、输入和说明，保留 class 钩子与必要结构 CSS。
- [x] 使用现有 Input/NumberInput/Textarea/Checkbox 等适配原生控件，保留草稿、submit、空值与 focus 语义；不设计新 Tabs API。
- [x] 运行相应组件测试与类型检查，记录命令/结果/残余 CSS 原因，等待独立审查。

## Task 2：公共页面、表单、弹层和表格（独立写集 B）

**Files:** `packages/effects/common-ui/src/styles.css`、`auth/`、`system-state/`、`page-header/`、`read-state/`、`filter-bar/`、`detail-frame/`、`quick-view/`、`action-preview/`、`form-frame/`、`form/`、`overlay/`、`data-table/`。

**Interfaces:** 所有公开组件/表单/查询接口及 DOM 钩子不变；动态 schema 和 table 尺寸仍由变量/内联值负责。

- [x] 先运行相关行为测试；针对认证 ref/校验/错误焦点和控件转换写必要回归，验证失败再修复。
- [x] 迁认证和状态页，再迁页面模式、表单/弹层和表格 renderer 普通声明；使用现有 shadcn 基础控件。
- [x] 保留业务 JSX 直接消费的 `pattern-*` fallback、compact opt-in、schema 几何及公开 CSS 入口，移除迁完后无消费的声明。
- [x] 保留 Query/dirty/pending/owner 代码；仅在控件接入需要时适配事件，不能重写状态机。
- [x] 运行组件测试/typecheck/lint；交付文件、证据和兼容/残余 CSS 说明，等待独立审查。

## Task 3：外框、菜单、页签与 widgets（独立写集 C）

**Files:** `packages/@core/ui-kit/{layout-ui,menu-ui,tabs-ui}/src/`、`packages/effects/layouts/src/{widgets,routing}/`。

**Interfaces:** layout model、class/data、slot、scroll owner、tab 会话和路由接口保持不变。

- [x] 用既有 layout geometry、navigation 和 tabs 行为测试锁定契约；修改样式测试时保留它保护的行为。
- [x] 迁静态排布和单元素装饰；保留 BusinessLayout grid/sticky/fixed 几何、菜单缩进/定位、Chrome tabs 曲面、动画/reduced-motion。
- [x] widgets 的用户下拉/锁屏等使用公共控件；保持本地主题区域和精确断点，禁止给 main 添加内层主滚动。
- [x] 运行相关测试/typecheck/lint，交付残余 CSS 与消费契约清单，等待独立审查。

## Task 4：Playground 收敛与集成（主控）

**Files:** `apps/playground/src/{app,auth,modules,system,examples,styles}/`；必要的模板集成测试。

**Interfaces:** 消费 Tasks 1–3 的不变 exports/props；不改 pageId/菜单/权限/认证/API/Query 契约。

- [x] 登录/Brand、home/Guard、系统 CRUD、组件/表单/表格/功能示例普通样式迁入组件。
- [x] 清理 index/visual/login/brand 的重复控件覆盖；品牌/插画颜色转 app 范围变量，保留必要伪元素和媒体规则。
- [x] 对应用仍使用的裸控件接现有 shadcn；文件输入/progress、语义表格/fieldset、链接和 Radix trigger 按原角色保留。
- [x] 适配真实 CSS 组合与边界测试，使其消费构建 CSS/语义，不通过删除断言放宽验收。
- [x] 对照 Task 方案每批提供的验收界面汇总变化；不声称已完成 Vben 像素对齐或用户视觉验收。

## Task 5：集成检查、独立审查与本地提交（主控）

- [x] 各写集完成后逐项审阅 diff 和功能范围；由未参与对应实现者独立审查规格与代码质量，修复后复核。
- [x] 执行最终默认 `pnpm check`、`pnpm format:check`；不重复冷跑、不触发 E2E。记录预算与未覆盖项。
- [x] 核业务功能源码未同步，额外仅提交用户明确要求的 `.gitignore` 单行；核公共 CSS exports/class/几何/偏好保留。
- [x] 公共包/测试与 Playground 改动分开本地提交；在功能分支提供用户验收，不推送。

## Task 6：任务、Case 与人工验收交接（主控）

- [x] 将实际实现、命令/退出码、审查及提交写回准确 3-1 Task 和 Case，登记本计划。
- [x] 若人工视觉、master 合并、业务同步未进行，保留相应验收未勾选，不把 3-1 写成 done。
- [x] 清理本轮无用临时脚本，保留可复核证据；等待用户视觉确认与业务同步指令。
