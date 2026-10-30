# @niubu/common-ui

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

Import ./page-header, ./detail-frame, ./read-state, ./filter-bar, ./form-frame, ./quick-view, ./action-preview or ./unsaved-guard. ./form-frame also exports useRestorableForm. Import ./styles.css for the existing pattern CSS. ./return-path exports ReturnPathProvider/useReturnPathResolver: inject an app-owned resolver into each mounted tree. An unbound tree rejects return destinations to /. Components receive navigation callbacks; no app, router, chart or CSV dependencies. The `./data-table`, `./form`, `./preferences`, `./auth`, `./overlay`, and `./system-state` entries expose shared table, schema form, preferences, authentication, overlay and state components. See the [form and CRUD guide](../../../docs/guide/forms-query-crud.md) and [public exports](package.json).

`./display-preferences` exports controlled theme/density choices and core-derived DisplayPreferences. Labels use the public shell namespace; callbacks and persistence diagnostics are caller inputs. Original display CSS is owned by the public `./styles.css` export.


## 表格对齐与单元格呈现

从 `@niubu/common-ui/data-table` 导入 `DataTable`、`RowActions`、`CellText`、`CollectionCell`。所有表格profile支持 `align="start|center|end"`，默认center；`columnAlign={{ description: 'start', amount: 'end' }}` 按当前column ID覆盖，分组表头使用自身ID。对齐不改变列宽、固定列偏移或resizer；树列保留层级缩进：start/center使用起始留白，end使用末端留白，使末端对齐时仍能识别深度。

`RowActions` 接收 `actions: { id, label, disabled?, destructive? } & ({ onSelect } | { href })` 的数组、`ownerKey`、`rowLabel` 和可选 `moreLabel`、`renderLink`。`href` 动作渲染为链接而不是按钮（禁用时退化为不可点击的按钮），不走菜单退出后的焦点交接；用 `renderLink={(href, label) => <Link to={href}>{label}</Link>}` 接入应用路由，默认是普通 `<a>`。首动作直接显示，其余进入更多菜单。调用方先过滤可用动作，并在回调内核对当前写资格；ownerKey包含身份、scope、generation及行边界，变化时退休旧菜单和待执行选择。请使用稳定的cell组件身份，避免重渲染替换焦点返回目标。菜单退出后微任务再次核对最新动作和挂载状态，再执行回调；Portal保留行操作标记，不触发行激活。

`CellText` 的 `value` 接受string/number/boolean/null/undefined；null、undefined和空串使用 `emptyText`（默认—），0/false保留。`detail` 可提供完整title，视觉截断不修改文本。`CollectionCell<T>` 接收 `items` 和显式 `describeItem(item,index): string`；摘要默认使用公共语言资源，也可用 `formatSummary(count)` 定制。对象字段及业务状态解释由应用负责。

实际组合与作用域、弹窗示例见 [Playground PresentationExample](../../../apps/playground/src/examples/tables/PresentationExample.tsx)。
