# 通用表格呈现能力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将已验收的行操作、对齐及文本集合呈现抽象为公共能力，补 Playground 示例，完整检查通过后提交推送。

**Architecture:** 沿现有 common-ui/data-table 公开入口提供 RowActions、CellText、CollectionCell；DataTable增加可选align及columnAlign。应用负责动作资格与owner，公共组件不读取业务权限；Playground使用合成数据和稳定cell。

**Tech Stack:** React、TypeScript、Tailwind、Radix、TanStack Table、Vitest，沿现有版本。

**Spec:** 用户2026-10-24已确认的三项同步要求，以及上一轮template-sync-review中P1/P2范围；不新增外部设计依赖。

## Global Constraints

- 不引入IAM字段、状态、业务权限、菜单初始化或产品包；不新增依赖。
- 使用当前干净checkout和独立分支codex/table-presentation，沿仓库复用依赖缓存规则，不另建worktree。
- 公共能力与Playground示例分开提交；仅推送开发分支，不合并。
- 不新增或运行自动化E2E；组件测试、完整pnpm check、pnpm format:check及浏览器操作按现有规则执行。
- 验证记录留在被忽略的.superpowers；公开说明仅描述接口与边界。

## Review Focus

- owner变化、卸载、撤权或disabled发生在菜单退出期间时，旧动作不得执行。
- Portal菜单项不能同时触发行激活；菜单到Modal/confirm关闭后恢复仍连接的触发点。
- read/list/selectable/tree都消费对齐选项；保持默认start、分组表头独立覆盖、选择框、固定列、resizer及树缩进。
- 0/false不被当空值，集合描述由调用方显式传入，不猜对象业务字段。
- 示例重渲染与scope变化不保留旧owner状态，文案中英文一致。

### Task 1: 公共行操作与内容单元格

**Files:** 新建common-ui/src/data-table/RowActions.tsx、CellText.tsx、CollectionCell.tsx及对应组件测试；修改index.ts、公共common双语文案及common-ui README。

**Interfaces:** RowAction{id,label,onSelect,disabled?,destructive?}；RowActions{actions,ownerKey,rowLabel,moreLabel?}；CellText{value:string|number|boolean|null|undefined,detail?,emptyText?}；CollectionCell<T>{items:readonly T[]|null|undefined,describeItem:(item,index)=>string,formatSummary?:(count)=>string,emptyText?}。均从@niubu/common-ui/data-table导出。

- [x] 先写测试：首动作/更多、disabled/ESC、owner切换、退出前撤权、Portal行激活保护和真实Modal焦点；文本0/false/空值、对象集合描述与完整详情。
- [x] 用最小接口桩运行相关Vitest，确认缺失行为的RED。
- [ ] 实现最新提交动作引用、owner与挂载校验，菜单退出后的微任务再次校验；不访问业务权限。实现文本与集合组件及双语默认文案。
- [x] 相关测试GREEN，再运行common-ui test/typecheck/lint。
- [ ] 保留通过结果，Task 1/2公共能力完成后合并为公共包提交。

### Task 2: DataTable对齐

**Files:** 修改data-table/types.ts、renderer.tsx、DataTable.tsx、index.ts；新增alignment.test.tsx；按需新增alignment.ts保存小型纯解析器。

**Interfaces:** TableAlignment='start'|'center'|'end'；BaseTableProps新增align?:TableAlignment、columnAlign?:Readonly<Record<string,TableAlignment>>。按当前column.id覆盖，再回退table align或start；QueryDataTable透传现有table props。

- [x] 先写四profile/按列覆盖/分组header/固定列与键盘resize/树缩进测试，运行确认RED。
- [x] read独立renderer及共用HeaderView/CellView/树层级列统一消费对齐；仅center/end使用对称排序留白，不改默认start外观。
- [x] 对齐测试及既有表格测试GREEN，补公共使用说明。
- [ ] 公共包改动与计划单独提交，示例后续提交。

### Task 3: Playground示例与最终交付

**Files:** 新建apps/playground/src/examples/tables/PresentationExample.tsx及测试；修改TablesPage.tsx、copy.ts、双语app.json、guides/tables.md。

**Interfaces:** 使用Task 1/2公开入口；稳定cell组件通过最新React context供动作回调。合成数据展示居中与按列覆盖、空值/长文本/对象集合、首动作＋更多、禁用动作与安全取消的Modal。

- [x] 示例测试先RED：居中/列覆盖、集合详情、菜单开关与Modal取消焦点、scope退休；再实现到GREEN。
- [ ] 保留全部现有TablesPage测试与说明，示例与公共包分开提交。
- [x] 运行完整pnpm check和pnpm format:check，读真实退出码和结果；失败修复并按影响重跑。
- [x] 浏览器检查实际CSS、排序/resizer/固定列/树/菜单/弹窗/亮暗；记录到忽略目录。
- [ ] 全分支只读独立审查，修复实质问题，核无IAM业务迁入；检查通过后推送分支并核远端HEAD。
