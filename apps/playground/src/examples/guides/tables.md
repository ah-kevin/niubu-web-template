# DataTable 示例使用指南 / DataTable examples

源码入口：`apps/playground/src/examples/tables/TablesPage.tsx`。仓库完整指南位于 `docs/guide/forms-query-crud.md`。页面记录和服务器均为合成 fixture，不访问业务 API；列偏好存入该场景的内存 owner。

- E63：`DataTable` 区分 read、list、selectable-list profiles；稳定 getRowId，客户端排序、分页和选择。
- E64：typed column helpers 与自定义状态单元格。
- E67：`useTablePreferences` 的列显隐、宽度、逻辑 start/end 固定及作用域隔离。
- E68：`useQueryDataTable` 拥有查询表单和已应用 DTO；reload 不读取尚未提交的草稿，reset 清空并再查询。
- E69：abortable server loader、分页、排序、取消与刷新；scope 更新退休旧请求，迟到响应不能覆盖新结果。

这不是 VXE API 示例。行/单元格编辑事务、固定表头、已读行历史、虚拟滚动和导出继续保留缺口。

Use the existing typed table profiles and query controller. Synthetic fixtures make sorting, paging, selection, scoped preferences and cancellation visible without real business data or services. Unsupported VXE contracts remain deferred.


## 呈现与行操作

`PresentationExample.tsx` 使用公开 `@niubu/common-ui/data-table` 入口演示 `RowActions`、`CellText`、`CollectionCell` 及 `DataTable align/columnAlign`。整表可切换逻辑start/center/end，说明列显式覆盖为start；独立树表示例也可切换对齐；末端对齐使用末端留白保留可见深度，排序和列宽控件独立工作。

行操作由应用提供稳定ID、当前ownerKey、行名称和回调；公共组件不读取业务权限。示例的菜单、禁用和危险动作只打开本地弹窗，确认只更新本页提示。稳定action cell通过React context读取当前scope与回调；作用域变化会退休旧菜单和弹窗。空值显示标记，长文本保留完整title；对象集合由describeItem明确描述，公共包不猜字段。

树表示范还使用 `toolbar.render(node)` 将真实工具条 `createPortal` 到本例自己的 host；目标由 commit ref 就绪后提供，未就绪返回 null，不复制列设置或 table 状态。`toolbar.title: null` 去重复标题；缺省仍内部显示。全屏时公共表格强制把同一工具放回自身，确保退出始终可达，退出后再回到外置位置。
