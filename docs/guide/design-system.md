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

## 表格的已实现范围

DataTable 的 read/list/selectable-list/tree-list 保留现有 model、排序、分页、列显隐/宽度/固定、选择、工具栏和作用域合同。空、错、加载时保留表头，状态行跨可见列；selected 行和打开菜单的行读取状态呈现。行操作桌面最多直接显示一个普通动作，窄于 960px 全部放入更多；危险项在菜单最后并与普通项分隔。

树的“展开全部 / 收起全部”通过已有受控 expanded 传 true / {} 组合，无新模型。固定列保留逻辑方向 start/end。

非 ready 的 rows 必须为空、计数未知，因此当前刷新不显示半透明旧行。通用详情展开、行内编辑、body rowspan、汇总行、行拖拽、树懒加载与级联、列筛选及固定表头配置仍未提供；不要把底层能力或静态示例当作 DataTable 已支持的 API。

示例见 Feedback、Forms 的“失焦校验”、Tables 的三层树与现有表格组合。
