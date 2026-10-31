# @niubu/shadcn-ui

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

Import ./button, ./input, ./label, ./table, ./dialog, ./sheet, ./alert-dialog or ./cn. Existing Radix compositions and LICENSE.shadcn are preserved. React is a host peer. Charts belong to @niubu/plugins/chart.

## 基础控件

主体控件沿用已有尺寸、圆角和 padding token；偏好抽屉、顶栏、侧栏保留原有控件外观。

- `Button` 保留原有 variant / size，增加 `link-danger`。加载态沿用 `disabled` + `aria-busy`，阻止操作但保留配色。
- `NumberInput` 默认仍是单个原生数字输入。`controls` 启用增减按钮时，同时传入本地化的 `decreaseLabel` / `increaseLabel`。`valueMode="number"` 输出 `number | null`；`valueMode="string"` 保留输入草稿，清空输出空字符串。步进采用原生 `min` / `max` / `step`，`readOnly`、`disabled` 和 `step="any"` 不允许按钮步进；`ref` 仍指向 input。
- `TabsList` 的 `variant` 支持 `segmented`（默认）与 `line`。
- `Badge` 增加 `neutral` / `primary` / `success` / `warning` / `info` / `danger`，旧 variant 保留。`count` 超过 99 显示 `99+`；`dot` 必须同时提供说明新内容的 `aria-label`。
- `Card` 的 `interactive` 只启用交互外观；通过内部原生按钮或链接提供实际操作。`selected` 启用选中外观。
- `Divider` 与 `Separator` 从同一入口导出；前者支持文字和默认外边距，后者保留原有布局。
- `PaginationLink` / `PaginationPrevious` / `PaginationNext` 接受 `disabled`，保留链接语义，阻断点击并退出 Tab 顺序。

完整交互示例在 Playground `/examples/components`。示例中的主题与密度仅影响该示例容器。

数字输入的步进模式支持 `unit` 文本后缀，后缀通过描述关联到输入，不进入提交值；普通输入模式保持不变。可交互 Card 由调用方提供按钮语义和键盘处理，Playground 展示点击、Enter 与空格切换。

`./input` 同时导出 `InputGroup`、`InputGroupAddon`。将原 `Input` 放在前后缀之间即可组合；Input 的 ref、name 和表单值保持原行为，点击非交互前后缀会聚焦输入。装饰性图标使用 `aria-hidden`；有意义的单位或说明由调用方通过 `aria-describedby` 关联。

`Button` 的 `loading` 控制忙碌状态并禁用操作；显式传入 `loading={false}` 时保留加载图标的位置，使切换到加载态前后宽度稳定。未传入时保持普通按钮布局。
