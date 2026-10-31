# 主体区设计系统组件

组件沿用当前主题与密度 token；在 Playground 切换浅色/深色和标准/紧凑检查实际呈现，不复制设计预览 CSS。页面壳层沿用原实现。

## 浮层与菜单

业务弹层继续使用 `@niubu/common-ui/overlay` 的 `Modal`、`Drawer`。`size="wide"` 使用大尺寸 token，`fullscreen` 优先；标题、底部操作保持可见，内容独立滚动。关闭、dirty 确认、取消、焦点恢复沿用原 owner。`data-scroll` 表示内容超过可视高度。

`useOverlay().confirm({ title, description, tone: 'danger', signal })` 可显示危险确认；`tone` 可省略，也支持 `warning`。默认确认按钮语义保持，危险确认使用危险色，初始焦点仍在取消。原 FIFO、AbortSignal 和关闭后的焦点恢复不变。

`@niubu/shadcn-ui/dropdown-menu` 与 `/context-menu` 在原 Root/Trigger/Portal/Content/Item 外提供同前缀的 `Group`、`Label`、`Separator`、`CheckboxItem`、`RadioGroup`、`RadioItem`、`Sub`、`SubTrigger`、`SubContent`。普通项支持 `variant="danger"`，勾选项使用 `checked/onCheckedChange`，单选组使用 `value/onValueChange`。子菜单内容自行接入受控 Portal；外层 Content 继续放在现有 Portal 中。不要绕过 BusinessPortalAdmission 或自行把内容移到 document.body。

Popover 默认带箭头，`PopoverContent showArrow={false}` 可隐藏，`PopoverArrow` 可用于自定义组合。Tooltip 保留字符串内容接口，使用反相颜色；禁用按钮外包可聚焦元素后再作为触发器。

## 表单与反馈

`useSchemaForm` 默认在失焦时校验，提交仍校验全部字段、展开折叠错误并聚焦首个错误。输入、取消、配置替换和卸载仍使旧提交失效。横向标签由表单容器统一的 `--label-w` 控制，默认 6em；现有 `layout.labelWidth` 可继续传数值或 CSS 长度，`auto` 保持上方标签。

`FieldShell` 统一标签、说明和带图标的错误，并保留 aria-labelledby/describedby/invalid。`FormFrame` 的简单字符串 `FormField` 使用同一呈现；不创建第二个表单 owner。

`@niubu/common-ui/read-state` 提供：

- `Loading({ label?, size? })`：局部加载区，size 为 sm/md/lg，只有一个 live 状态。
- `Spinner({ label?, size? })`：无 label 时为装饰；传 label 时为独立状态。
- `Skeleton`：装饰性骨架，调用方指定宽高；默认对辅助技术隐藏。
- `Progress({ label, value? })`：label 必填，value 为 0–100 百分比，越界值夹紧；省略 value 表示不确定态。非有限值拒绝。
- `ReadState`：沿用现有状态和动作语义；`compact` 用于表内，`title` 可覆盖标题。actions 未传保留默认动作，null 隐藏动作区。

所有动画在 prefers-reduced-motion 下停止；这些组件不发起请求、不引入人工延迟。

## DataTable 表格能力

`read`、`list`、`selectable-list`、`tree-list` 沿用原来的数据和状态所有者。普通列表与可选列表支持以下可选配置，省略时保持原调用行为：

- `layout`：`stickyHeader`、`maxHeight`、`striped`、`bordered` 与 `wrap`；固定列继续使用 `columnPinning`。
- `columnFilters`：`local` 模式由 `matches` 在完整客户端数据中匹配；`manual` 模式由调用方接收受控筛选值并查询。`selection: 'multiple'` 使用类型化数组，同列条件为 OR、不同列为 AND。筛选由图标气泡编辑，应用后显示条件标签；保留默认单值接口。
- `details`：按稳定行 ID 保存展开状态，`render(row)` 提供详情内容；只展示一层详情。
- `editing`：`createDraft` 返回独立草稿，`renderCell` 组合现有控件，`validate` 返回按列的错误，`onSave` 接收 AbortSignal。调用方提交新 rows，组件不直接修改原模型。取消、owner 变化及行离开当前视图会终止旧操作。
- `cellSpan`：根据当前可见页面行列返回 `rowSpan/colSpan`；`mergeConsecutiveRows` 可生成相邻分组合并。不要将过滤前的固定行下标用于合并。
- `summary`：`renderCell` 根据当前展示页生成 `tfoot`，在标签中明确统计口径。
- `reorder`：通过必需的 `ownerKey` 界定数据所有者，回调使用稳定引用；使用原生拖拽或键盘移动，`onReorder` 接收建议的完整行 ID 顺序和 AbortSignal；只在客户端完整且无排序/筛选干扰的序列中启用。数据仍由调用方确认保存。
- `refresh="pending" | "error"`：调用方显式保留上一次成功的 ready 模型，刷新时变淡并覆盖加载圈，失败时显示可重试提示。普通 `readState` 非 ready 仍要求无 rows、计数未知。
- `selectionMode="single"`：可选列表改用单选，表头不显示全选，支持点击非交互单元格选中整行；默认仍为多选。`canSelectRow` 指定逐行选择资格，全选会跳过禁选行。
- `enableSortingRemoval`：显式启用未排→升序→降序→未排循环；未传时保留原有排序行为。

空、错、加载时保留表头。首次加载的骨架行数跟随 pageSize；筛选无结果与来源为空分别呈现。行操作桌面最多直接显示一个普通动作，窄于 960px 全部放入更多；危险项在菜单最后并与普通项分隔。

## 树表

`tree-list` 的 `tree` 配置支持：

- `selection.state`：受控或内部行选择；父子级联，祖先显示半选。`isDisabled` 指定的节点及其子树不参与级联。
- `lazy`：`ownerKey` 界定身份/作用域；`hasChildren` 声明未加载分支；`loadChildren(row, { signal })` 返回子节点。展开去重，失败可重试，owner 更换和卸载会取消旧请求，迟到结果不会写入新 owner。
- `search.query`：在已加载节点标签中搜索，保留匹配节点的祖先并临时展开；清空后恢复原展开。高亮按文本渲染，不接受 HTML，也不自动查询未知子节点。

原静态完整树、单行展开、展开全部/收起全部和受控 `expanded` 继续可用；名称列默认起始对齐。

## Playground 入口

左侧“组件示例”分为基础组件、浮层与反馈、表格、完整列表页和综合示例。每个基础组件与浮层反馈组件都有独立页面，页内只挂载选中组件；旧全集页保留在综合示例中。菜单使用不同的功能图标：

| 设计文件 / 场景 | 页面 |
| --- | --- |
| Button / Input / Textarea / NumberInput / Select | `/examples/components/button`、`input`、`textarea`、`number-input`、`select` |
| Checkbox / Radio / Switch / Slider / Tabs | `/examples/components/checkbox`、`radio`、`switch`、`slider`、`tabs` |
| Badge / Card / Divider / Pagination / ScrollArea / Label | `/examples/components/badge`、`card`、`divider`、`pagination`、`scroll-area`、`label` |
| FormField 独立表单项 | `/examples/components/form-field` |
| FormField、横向标签、失焦校验、提交聚焦 | `/examples/forms` |
| Modal / ConfirmDialog / Drawer / Popover / Tooltip | `/examples/feedback/modal`、`confirm-dialog`、`drawer`、`popover`、`tooltip` |
| DropdownMenu / ContextMenu / EmptyState / Loading | `/examples/feedback/dropdown-menu`、`context-menu`、`empty-state`、`loading` |
| TableChoose | `/examples/tables/choose` |
| Table | `/examples/tables/read` |
| TableRowActions | `/examples/tables/actions` |
| TableSelection 多选 / 单选 | `/examples/tables/selection`、`/examples/tables/single` |
| TableLayout | `/examples/tables/layout` |
| TableHeader | `/examples/tables/header` |
| TableExpand | `/examples/tables/expand` |
| TableEdit | `/examples/tables/edit` |
| TableMerge | `/examples/tables/merge` |
| TableDrag | `/examples/tables/drag` |
| TableStates | `/examples/tables/states` |
| TreeTable 级联、懒加载和搜索 | `/examples/tables/tree` |
| PageListLightStandard / LightCompact / DarkStandard / DarkCompact | `/examples/complete-list`，页内切换四种组合 |

列表页使用合成数据，新增、编辑、删除、批量操作只作用于本页状态。主题、密度、hover/focus/disabled 等状态使用实际控件操作，不复制设计预览的强制状态类。Sidebar、PageTabs、Header、AppShell 沿用项目壳层，Cover/index 不作为组件实现。
