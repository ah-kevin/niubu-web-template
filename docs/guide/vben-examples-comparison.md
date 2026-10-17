# Vben capability comparison and confirmed scope

Human confirmed 2026-10-17: existing capabilities and explicitly available partial subsets only; all gaps deferred.

状态：用户于2026-10-17确认8已有及41部分中的现有子集，23缺口保留，并恢复模板写入；原对照判定与边界保留，实施映射见文末。本页不将组件验证称为视觉或E2E验收。

### 基线与读法

- Vben：`151d80f9e5fb63f2ed8a8c432e1adf2eba253271`；源码范围 `playground/src/views/examples` 与 `demos`，共107个跟踪文件。下表72个主示例逐项覆盖，35个支撑文件另表逐项归属；8个关联路由另列，避免把引用到范围外组件的入口丢掉。
- 模板：`6110087a2fbd3db58e5712103c290a8f100b948b`。21包、92公开入口、737条符号记录不等于737个组件；依据实际公开导出和实现核读。对照时Playground只登记9条原有路由；实施后增加11个菜单入口和5个隐藏页面，共25条静态路由，实现索引见文末。
- 判定按参考页完整行为：**已有 8**，核心机制可用；**部分 41**，只展示明确存在的子集；**缺口 23**，核心能力/成品或公开合约缺失，不默认实现。不同Vue/React API写法不是缺陷，也不承诺Vben API兼容。
- 包名可含公开子路径；`useSchemaForm().Fields/Form/form`是返回实例成员，不是独立export；标注“类型契约”的条目不是运行组件。实施只使用app已声明包；`@niubu/core-shared`工具经已声明的`@niubu/utils`重导出使用，不新增依赖。
- 每行“拟做”可合并到同页的多个场景，不等于新增72个菜单。需要接入现有owner/controller属于示例工作，不能据此声称DOM保活等缺口已存在。只做现有能力；缺口、替代或新增公共能力必须由用户选择。

### 逐项主表示例

路径省略共同前缀 `playground/src/views/`。

| 编号 | Vben文件 / 示例 | 现有包 / 导出 | 确认示例范围（实现索引见文末） | 判定 | 差异、缺口与本轮边界 |
| --- | --- | --- | --- | --- | --- |
| E01 | `demos/access/admin-visible.vue`<br>Admin 可见 | `@niubu/access`：`resolveAccess` | 角色页面可见性：admin | 已有 | 角色机制已有；演示数据需明确角色（当前默认账号仅admin/viewer）。 |
| E02 | `demos/access/button-control.vue`<br>按钮控制 | `@niubu/access/react`：`AccessControl`, `useAccess`；`@niubu/stores`：`createAuthSession` | 按钮角色、权限码与 any/all | 已有 | React AccessControl/函数表达同类控制，Vue指令语法不复制。 |
| E03 | `demos/access/index.vue`<br>页面访问 | `@niubu/access`：`resolveAccess`；`@niubu/stores`：`createAuthSession` | 页面权限、身份与 scope 边界 | 部分 | 现有权限策略解析/身份scope；应用运行时模式切换与DOM实例保活未封装。 |
| E04 | `demos/access/menu-visible-403.vue`<br>菜单可见(403) | 仅邻近基础：`@niubu/access`：`resolveAccess` | 菜单可见但进入 403：待决缺口 | 缺口 | eligible=false被投影过滤；直接访问403不等于菜单仍可见，此项缺口。 |
| E05 | `demos/access/super-visible.vue`<br>Super 可见 | `@niubu/access`：`resolveAccess` | 角色页面可见性：super | 已有 | 角色机制已有；默认样例尚无super账号，需经确认补合成数据，不改生产认证。 |
| E06 | `demos/access/user-visible.vue`<br>User 可见 | `@niubu/access`：`resolveAccess` | 角色页面可见性：user | 已有 | 角色机制已有；默认样例尚无user角色账号，需经确认补合成数据。 |
| E07 | `demos/active-icon/index.vue`<br>子级激活图标 | `@niubu/menu-ui`：`TreeNavigation` | 现有菜单激活态；activeIcon待选 | 部分 | 单图标/激活样式已有；无activeIcon元字段及自动切换投影。 |
| E08 | `demos/badge/index.vue`<br>点徽标 / 文本徽标 / 徽标颜色 | `@niubu/menu-ui`：`TreeNavigation`；`@niubu/access`：`resolveAccess` | 菜单文本/数字徽标；dot/颜色待选 | 部分 | 仅文本/数字徽标；dot、颜色variants及菜单动态更新契约缺口。 |
| E09 | `demos/breadcrumb/lateral-detail.vue`<br>平级模式详情 | `@niubu/access`：`projectBreadcrumbs`, `resolveAccess`；`@niubu/layouts/widgets`：`Breadcrumbs` | 面包屑：隐藏详情与返回 | 部分 | 隐藏详情与返回可组合；Vben matched自动层级规则不同，不承诺一比一投影。 |
| E10 | `demos/breadcrumb/lateral.vue`<br>平级模式 | `@niubu/access`：`projectBreadcrumbs`, `resolveAccess`；`@niubu/layouts/widgets`：`Breadcrumbs` | 面包屑：平级列表与详情 | 部分 | 组件可渲染items；自动投影基于domain/静态路径，不等于Vue matched；示例按现有链生成规则。 |
| E11 | `demos/breadcrumb/level-detail.vue`<br>层级模式详情 | `@niubu/access`：`projectBreadcrumbs`, `resolveAccess`；`@niubu/layouts/widgets`：`Breadcrumbs` | 面包屑：多层详情 | 部分 | 多层items可渲染；自动投影策略不同，需按现有静态登记链演示。 |
| E12 | `demos/features/clipboard/index.vue`<br>剪贴板 | `@niubu/preferences`：`copyEffectiveConfiguration` | 配置复制（已有）与通用剪贴板差异 | 部分 | 已有配置复制；无通用useClipboard/readText/legacy回退封装。 |
| E13 | `demos/features/file-download/index.vue`<br>文件下载 | `@niubu/request`：`downloadBlob`, `createRequestClient` | 统一 Blob 下载与元数据 | 部分 | downloadBlob返回Blob/元数据，保存用现有app适配；四类downloadFileFrom*未公开。 |
| E14 | `demos/features/full-screen/index.vue`<br>全屏 | `@niubu/hooks`：`createFullscreenController` | 根文档全屏与目标元素边界 | 部分 | 仅根documentElement toggle；无任意目标元素或独立enter/exit接口。 |
| E15 | `demos/features/hide-menu-children/children.vue`<br>隐藏子菜单 | `@niubu/access`：`resolveAccess`；`@niubu/layouts/routing`：`usePageTabs` | 隐藏子菜单：直接访问和关闭 | 部分 | 逐页hideInMenu可用；无父级hideChildrenInMenu同等语义。 |
| E16 | `demos/features/hide-menu-children/parent.vue`<br>隐藏子菜单 | `@niubu/access`：`resolveAccess` | 隐藏子菜单：父入口 | 部分 | 逐页隐藏与分组已有；父节点自动隐藏子树的投影语义缺口。 |
| E17 | `demos/features/icons/index.vue`<br>图标 | `@niubu/icons`：`createIconRegistry` | React 图标登记与选择器差异 | 部分 | 显式Lucide registry已有；Iconify动态库、SVG图集和Picker缺口。 |
| E18 | `demos/features/json-bigint/index.vue`<br>JSON BigInt | 仅邻近基础：`@niubu/request`：`createRequestClient` | 长整数 JSON：待决契约 | 缺口 | response.json可能先丢精度；无无损JSON入口，不能借Blob绕开JSON协议。 |
| E19 | `demos/features/login-expired/index.vue`<br>登录过期 | `@niubu/stores`：`createAuthSession`；`@niubu/request`：`isAccessExpired` | 登录失效、续期失败与恢复 | 部分 | 严格401+ACCESS_EXPIRED续期/弹窗已有；无page/modal偏好切换，不把任意401当过期。 |
| E20 | `demos/features/menu-query/index.vue`<br>带参菜单 | `@niubu/access`：`navigationHref`；`@niubu/utils`：`parseQuery`, `mergeQuery`；`@niubu/menu-ui`：`TreeNavigation` | 安全查询工具；菜单业务query暂不扩展 | 部分 | 安全URL工具已有；菜单DTO/投影无任意业务query字段，不绕过稳定pageId约束。 |
| E21 | `demos/features/new-window/index.vue`<br>新窗口打开 | `@niubu/access`：`resolveAccess`；`@niubu/menu-ui`：`TreeNavigation` | 内部页面新窗口打开 | 已有 | 现有openInNewWindow投影；原生链接_blank配noopener noreferrer。 |
| E22 | `demos/features/preferences-extension/index.vue`<br>偏好扩展示例 | `@niubu/preferences`：`usePreferenceExtension`, `createPreferenceManager` | 业务偏好扩展：预设与响应式呈现 | 已有 | 现有扩展契约可示例；不未经设计新增内核字段。 |
| E23 | `demos/features/request-params-serializer/index.vue`<br>参数序列化 | `@niubu/request`：`createRequestClient` | 数组参数：重复键与预设边界 | 部分 | URLSearchParams可传重复键；无四种预设serializer和Axios responseURL协议。 |
| E24 | `demos/features/tabs/index.vue`<br>标签页 | `@niubu/stores`：`createTabStore`, `planTabIntent`；`@niubu/layouts/routing`：`usePageTabs`, `RouteFrame` | 标签操作、刷新与容量语义 | 部分 | 已有标签/刷新/容量机制；动态标题、按路由限额、DOM保活缺口，示例需接现有绑定。 |
| E25 | `demos/features/tabs/tab-detail.vue`<br>标签详情页 | `@niubu/stores`：`createPageIdentityResolver`, `createTabStore`；`@niubu/access`：`resolveAccess` | 详情标签身份与动态标题 | 部分 | 详情身份解析已有；无动态标题覆盖/按路由三标签限额/DOM保活。 |
| E26 | `demos/features/vue-query/index.vue`<br>Tanstack Query | `@tanstack/react-query`：`QueryClientProvider, useQuery, useInfiniteQuery, queryOptions, useQueryClient, keepPreviousData, QueryClient.fetchQuery` | TanStack React Query：分页、重试、并发缓存和加载更多 | 已有 | 已声明React Query；安全读重试与缓存key须含身份/scope/generation，不照搬Vue固定queryKey。 |
| E27 | `demos/features/watermark/index.vue`<br>水印 | `@niubu/layouts/widgets`：`Watermark`；`@niubu/preferences`：`createPreferenceManager` | 文本水印与高级水印边界 | 部分 | 文本水印已有；高级渐变网格/透明度旋转尺寸/实例更新销毁接口缺口。 |
| E28 | `demos/form-array/index.vue`<br>数组字段 | 仅邻近基础：`@niubu/common-ui/form`：`BuiltinFieldKind（类型契约）`, `CustomFieldRegistry（类型契约）`, `useSchemaForm` | 暂不做数组行编辑器 | 缺口 | 无公开array kind/行增删/min/max/行上下文；未声明RHF直接依赖，不跨包导入useFieldArray。 |
| E29 | `demos/nested/menu-1.vue`<br>菜单 1 | `@niubu/access`：`resolveAccess`；`@niubu/menu-ui`：`TreeNavigation` | 嵌套菜单：menu-1 | 部分 | 树导航已有；Vben keepAlive/domCached和父级折叠投影不自动等价。 |
| E30 | `demos/nested/menu-2-1.vue`<br>菜单 2-1 | `@niubu/access`：`resolveAccess`；`@niubu/menu-ui`：`TreeNavigation` | 嵌套菜单：menu-2-1 | 部分 | 树导航已有；Vben keepAlive/domCached和父级折叠投影不自动等价。 |
| E31 | `demos/nested/menu-3-1.vue`<br>菜单 3-1 | `@niubu/access`：`resolveAccess`；`@niubu/menu-ui`：`TreeNavigation` | 嵌套菜单：menu-3-1 | 部分 | 树导航已有；Vben keepAlive/domCached和父级折叠投影不自动等价。 |
| E32 | `demos/nested/menu-3-2-1.vue`<br>菜单 3-2-1 | `@niubu/access`：`resolveAccess`；`@niubu/menu-ui`：`TreeNavigation` | 嵌套菜单：menu-3-2-1 | 部分 | 树导航已有；Vben keepAlive/domCached和父级折叠投影不自动等价。 |
| E33 | `examples/button-group/index.vue`<br>按钮组 | `@niubu/shadcn-ui/button`：`Button`；`@niubu/shadcn-ui/radio-group`：`RadioGroup`；`@niubu/shadcn-ui/checkbox`：`Checkbox` | 基础控件/按钮与单多选组合 | 部分 | 没有 ButtonGroup/CheckButtonGroup 公共封装及其 beforeChange/maxCount 组级契约 |
| E34 | `examples/captcha/point-selection-captcha.vue`<br>点选验证 | 无对应公共成品导出 | 暂不建验证码页 | 缺口 | 没有 captcha 对应公共导出；数值 Slider 不是验证码 |
| E35 | `examples/captcha/slider-captcha.vue`<br>滑块验证 | 无对应公共成品导出 | 暂不建验证码页 | 缺口 | 没有 captcha 对应公共导出；数值 Slider 不是验证码 |
| E36 | `examples/captcha/slider-rotate-captcha.vue`<br>旋转验证 | 无对应公共成品导出 | 暂不建验证码页 | 缺口 | 没有 captcha 对应公共导出；数值 Slider 不是验证码 |
| E37 | `examples/captcha/slider-translate-captcha.vue`<br>拼图滑块验证 | 无对应公共成品导出 | 暂不建验证码页 | 缺口 | 没有 captcha 对应公共导出；数值 Slider 不是验证码 |
| E38 | `examples/context-menu/index.vue`<br>上下文菜单 | `@niubu/shadcn-ui/preference-primitives`：`ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem` | 基础控件/上下文菜单 | 已有 | 数据数组包装API不同；用React条件渲染和Item组合既有能力 |
| E39 | `examples/count-to/index.vue`<br>数字动画 | 无对应公共成品导出 | 暂不建数字动画页 | 缺口 | 无 CountTo/动画数值公共组件 |
| E40 | `examples/cropper/index.vue`<br>图片裁剪 | 无对应公共成品导出 | 暂不建裁剪页 | 缺口 | 无 Cropper 公共导出；上传/下载不等于图片裁剪 |
| E41 | `examples/drawer/index.vue`<br>抽屉 | `@niubu/common-ui/overlay`：`Drawer`；`@niubu/common-ui/form`：`useSchemaForm` | 反馈/抽屉现有能力 | 部分 | 受控右侧/fullscreen/表单已有；无placement/container、整层loading/lock、动画完成及关闭保留实例合约。React typed props可组合，不复刻Vben工厂。 |
| E42 | `examples/ellipsis/index.vue`<br>文本省略 | 仅邻近基础：`@niubu/shadcn-ui/preference-primitives`：`Tooltip` | 独立省略页暂不建；Tooltip基础另列 | 缺口 | 没有 EllipsisText 组件/自动测溢出/展开契约；Tooltip不能承诺任意ReactNode内容 |
| E43 | `examples/form/api.vue`<br>表单 API 操作 | `@niubu/common-ui/form`：`useSchemaForm`, `FormLayout（类型契约）`, `useSchemaForm().Form`, `useSchemaForm().form`, `ControlledField` | 表单/公开API | 部分 | 按getValues/setValues、form.reset、validate/submit/cancel和既有字段patch演示；无动态字段增删、控件实例和Vben全表state协议。 |
| E44 | `examples/form/basic.vue`<br>基础表单 | `@niubu/common-ui/form`：`useSchemaForm`, `ControlledField`；`@niubu/shadcn-ui/select`：`Select` | 表单/基础控件（11种） | 部分 | 已有11种内建字段；远程搜索/树控件、评分、图标、富文本、表单上传/裁剪等成品和双向codec缺口。 |
| E45 | `examples/form/collapsible.vue`<br>单项 / 参数 / 分组折叠 | 仅邻近基础：`@niubu/common-ui/form`：`FormGroup（类型契约）`, `useSchemaForm().Fields`, `CustomFieldRegistry（类型契约）`；`@niubu/common-ui/form-frame`：`FormGroup` | 暂不做单项/分组折叠 | 缺口 | 无独立字段/参数/组折叠契约；整体collapsedRows不能等价替代，暂不实施。 |
| E46 | `examples/form/custom-layout.vue`<br>自定义布局 | `@niubu/common-ui/form`：`FormFieldConfig（类型契约）`, `useSchemaForm().Fields`, `useSchemaForm().Form / useSchemaForm().Fields`；`@niubu/common-ui/form-frame`：`FormFrame` | 表单/列布局与JSX分区 | 部分 | 列数/colSpan与Fields(names)+JSX可用；无colStart/任意schema装饰/TreeSelect等成品。 |
| E47 | `examples/form/custom.vue`<br>自定义组件 | `@niubu/common-ui/form`：`CustomFieldRegistry / CustomFieldRenderProps（类型契约）`, `ControlledField`, `useSchemaForm`, `FieldShell` | 表单/自定义renderer契约 | 部分 | 已有React custom registry绑定接缝；TwoFields/TagPicker不是现成成品，不能照搬Vue协议或双向codec。 |
| E48 | `examples/form/dynamic.vue`<br>动态表单与联动 | `@niubu/common-ui/form`：`FieldDependencyResult（类型契约）`, `useSchemaForm().Fields`, `useSchemaForm` | 表单/已有字段联动 | 部分 | 仅既有字段纯derive与patch；无schema增删、双隐藏语义、副作用trigger或异步derive。 |
| E49 | `examples/form/label-width.vue`<br>Label 自动宽度 | 仅邻近基础：`@niubu/common-ui/form`：`FormLayout（类型契约）`, `useSchemaForm().Fields`, `useSchemaForm` | 暂不做自动测宽 | 缺口 | 现有auto意为顶部标签；无同组最大宽度测量/注册/重算，固定宽度不等价。 |
| E50 | `examples/form/merge.vue`<br>合并表单 / 分步提交 | 仅邻近基础：`@niubu/common-ui/form`：`useSchemaForm`, `useSchemaForm().Fields`；`@niubu/common-ui/form-frame`：`FormFrame` | 暂不做跨owner合并 | 缺口 | 无跨独立owner合并/验证聚合；单owner Fields分区不等价，暂不实施。 |
| E51 | `examples/form/query.vue`<br>查询表单 | `@niubu/common-ui/form`：`useSchemaForm().Fields`, `FormLayout（类型契约）`；`@niubu/common-ui/data-table`：`useQueryDataTable` | 表单/查询与收起 | 部分 | 现有整体收起与查询DTO；默认展开且可折叠、inline/动作位置/断点布局等契约不同。 |
| E52 | `examples/form/rules.vue`<br>表单校验 | `@niubu/common-ui/form`：`FormFieldConfig（类型契约）`, `useSchemaForm` | 表单/同步校验 | 部分 | 仅同步Zod、onSubmit；无异步refine/逐字段blur策略；解析结果不替换原值。 |
| E53 | `examples/form/scroll-to-error-test.vue`<br>滚动到错误字段 | `@niubu/common-ui/form`：`useSchemaForm`, `useSchemaForm().Form`, `useSchemaForm().Fields`；`@niubu/common-ui/form-frame`：`FormFrame` | 表单/提交失败聚焦 | 部分 | 提交失败会focus首个可见错误；无平滑scrollIntoView开关，validate路径不承诺同样定位。 |
| E54 | `examples/form/value-format.vue`<br>值格式化 / 表单 Codec | `@niubu/common-ui/form`：`useSchemaForm`, `ControlledField`, `SchemaFormOptions（类型契约）` | 表单/原值与单向DTO | 部分 | getValues为原值、toOutput单向输出；缺DTO解码/双向codec，不能称setValues自动回填转换。 |
| E55 | `examples/json-viewer/index.vue`<br>JSON 查看器 | 无对应公共成品导出 | 暂不建结构化JSON查看器页 | 缺口 | 无 JsonViewer/折叠树组件；JSON.stringify文本显示不等价 |
| E56 | `examples/layout/col-page.vue`<br>双列布局 | 仅邻近基础：`@niubu/layouts`：`BusinessShell` | 专用可拖拽双列页暂不建 | 缺口 | 无 ColPage/SplitPane 对应公开组件；应用侧栏不等价页面分栏 |
| E57 | `examples/loading/index.vue`<br>加载状态 | `@niubu/common-ui/read-state`：`ReadState`；`@niubu/layouts/routing`：`RoutePending` | 反馈/加载与读取状态 | 部分 | 无通用Loading/Spinner遮罩和v-loading指令；PendingOverlay只登记取消且return null |
| E58 | `examples/modal/index.vue`<br>弹窗 | `@niubu/common-ui/overlay`：`Modal`, `OverlayProvider`, `useOverlay` | 反馈/弹窗与确认队列 | 部分 | 受控、fullscreen、confirmLoading和alert/confirm已有；无draggable、整层loading/lock、动画完成回调及关闭保留实例契约。React typed props组合可用，Vben工厂仅形式差异；prompt及程序式beforeClose服务合约也未提供。 |
| E59 | `examples/motion/index.vue`<br>通用动效 | 仅邻近基础：`@niubu/layouts/routing`：`RouteMotion` | 通用Motion页暂不建 | 缺口 | 无通用Motion组件/API；RouteMotion不等价motion库 |
| E60 | `examples/resize/basic.vue`<br>拖动与尺寸调整 | 无对应公共成品导出 | 暂不建VResize页 | 缺口 | 无通用VResize/拖动矩形组件；表格列宽调整不是该能力 |
| E61 | `examples/tippy/index.vue`<br>Tippy 提示 | `@niubu/shadcn-ui/preference-primitives`：`Tooltip` | 基础控件/字符串Tooltip（需确认替代范围） | 部分 | 无Tippy库/API；当前Tooltip不暴露位置、任意内容或Tippy指令 |
| E62 | `examples/tiptap/index.vue`<br>富文本编辑器 | 无对应公共成品导出 | 暂不建富文本页 | 缺口 | 无Tiptap/富文本编辑器；Textarea不是等价替代 |
| E63 | `examples/vxe-table/basic.vue`<br>基础表格 | `@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | DataTable/基础（非VXE） | 部分 | 未引入vxe-table及其API；仅现有DataTable语义可展示 |
| E64 | `examples/vxe-table/custom-cell.vue`<br>自定义单元格 | `@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | DataTable/自定义列与单元格 | 部分 | VXE slots/代理接口不同，超出现有profile的能力不复制 |
| E65 | `examples/vxe-table/edit-cell.vue`<br>单元格编辑 | 仅邻近基础：`@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | 行内编辑暂不建页 | 缺口 | DataTableProps无单元格编辑状态/提交事务API；Input存在不等价 |
| E66 | `examples/vxe-table/edit-row.vue`<br>行编辑 | 仅邻近基础：`@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | 整行编辑暂不建页 | 缺口 | 无行编辑事务/恢复API；不以自定义input伪装已支持 |
| E67 | `examples/vxe-table/fixed.vue`<br>固定表头/列 | `@niubu/common-ui/data-table`：`DataTable`, `useTablePreferences` | DataTable/列固定与列设置 | 部分 | 现有表头position:relative，无公开固定表头契约；VXE API不存在 |
| E68 | `examples/vxe-table/form.vue`<br>查询表单与表格 | `@niubu/common-ui/data-table`：`QueryDataTable`, `useQueryDataTable`；`@niubu/common-ui/form`：`useSchemaForm` | DataTable/查询、重置与作用域取消 | 部分 | VXE表单/导出/zoom工具条API不在现有组件中 |
| E69 | `examples/vxe-table/remote.vue`<br>远程加载 | `@niubu/common-ui/data-table`：`useQueryDataTable`, `DataTable` | DataTable/远程、取消与刷新 | 部分 | VXE proxy/keepSource/export/zoom接口缺口；不直接复制工具条 |
| E70 | `examples/vxe-table/tree.vue`<br>树形表格 | 仅邻近基础：`@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | 树形表格暂不建页 | 缺口 | 公开profiles无tree/expanded/getSubRows；TreeNavigation不是TreeTable |
| E71 | `examples/vxe-table/viewed.vue`<br>已读行标记 | 仅邻近基础：`@niubu/common-ui/data-table`：`DataTable` | 已读行追踪暂不建页 | 缺口 | 无viewedRows/markKeysAsViewed/持久化契约；ReadColumnHelper意为只读列 |
| E72 | `examples/vxe-table/virtual.vue`<br>虚拟滚动 | 仅邻近基础：`@niubu/common-ui/data-table`：`DataTable`, `createListColumnHelper` | 虚拟表格暂不建页 | 缺口 | 当前渲染rows.map，无Virtualizer/窗口化profile；滚动容器不等价 |

### 支撑文件逐项归属

这些不是独立菜单页，纳入所属主示例的同页卡片、renderer、数据或类型；行为边界仍逐项保留。

| 文件 | 主项 | 判定 / 范围 |
| --- | --- | --- |
| `demos/features/file-download/base64.ts` | E13 | 支撑数据/类型：复用所属主项；不独立建页，也不新增能力。 |
| `demos/features/vue-query/concurrency-caching.vue` | E26 | 已有机制：已声明React Query具备对应机制；用React写法及身份/scope查询key，尚未实现。 |
| `demos/features/vue-query/infinite-queries.vue` | E26 | 已有机制：已声明React Query具备对应机制；用React写法及身份/scope查询key，尚未实现。 |
| `demos/features/vue-query/paginated-queries.vue` | E26 | 已有机制：已声明React Query具备对应机制；用React写法及身份/scope查询key，尚未实现。 |
| `demos/features/vue-query/query-retries.vue` | E26 | 已有机制：已声明React Query具备对应机制；用React写法及身份/scope查询key，尚未实现。 |
| `demos/features/vue-query/typing.ts` | E26 | 支撑数据/类型：复用所属主项；不独立建页，也不新增能力。 |
| `demos/form-array/README.md` | E28 | 文档：仅参考说明；数组真实行为以Vben组件源码为准，不据过时README声称支持。 |
| `examples/doc-button.vue` | E41, E42, E44, E45, E46, E49, E54, E58, E63 | 文档支撑：文档链接按钮；复用既有Button/链接，不独立注册示例页。 |
| `examples/drawer/auto-height-demo.vue` | E41 | 部分：仅已有内容滚动/flex/数据更新；无同等测高和整层loading。confirmLoading只作用确认按钮，不是遮罩或lock。 |
| `examples/drawer/base-demo.vue` | E41 | 部分：受控开关/确认禁用/onRequestClose可组合；无整层loading/lock、隐藏关闭按钮和opened/closed动画完成通知。 |
| `examples/drawer/dynamic-demo.vue` | E41 | 部分：可更新标题/fullscreen/confirmLoading等公开props；draggable/placement/整层loading等额外参数不在现有子集。 |
| `examples/drawer/form-drawer-demo.vue` | E41 | 已有基础组合：现有useSchemaForm与高层Modal/Drawer组合；保留单owner/关闭租约。 |
| `examples/drawer/in-content-demo.vue` | E41 | 缺口/行为差异：高层未暴露同等内容定位；open &&关闭卸载子树，无destroyOnClose:false实例保留。外层保留值不等于DOM保活。 |
| `examples/drawer/shared-data-demo.vue` | E41 | 已有基础组合：可用React props/回调共享数据；不承诺Vben数据工厂。 |
| `examples/drawer/typed-data-auto-demo.vue` | E41 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/drawer/typed-data-contract.ts` | E41 | 共享类型及泛型工厂支撑：React有类型props/回调组合已有；Vben预绑定typed composable工厂形式不复制，不宣称底层类型安全缺失。 |
| `examples/drawer/typed-data-explicit-demo.vue` | E41 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/drawer/typed-data-factory-demo.vue` | E41 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/form/modules/tag-picker.vue` | E47 | 扩展接缝：现有custom registry可接React renderer；该Vue成品控件不是现有React成品。 |
| `examples/form/modules/two-fields.vue` | E47 | 扩展接缝：现有custom registry可接React renderer；该Vue成品控件不是现有React成品。 |
| `examples/json-viewer/data.ts` | E55 | 支撑数据/类型：复用所属主项；不独立建页，也不新增能力。 |
| `examples/modal/auto-height-demo.vue` | E58 | 部分：仅已有内容滚动/flex/数据更新；无同等测高和整层loading。confirmLoading只作用确认按钮，不是遮罩或lock。 |
| `examples/modal/base-demo.vue` | E58 | 部分：受控开关/确认禁用/onRequestClose可组合；无整层loading/lock、隐藏关闭按钮和opened/closed动画完成通知。 |
| `examples/modal/blur-demo.vue` | E58 | 缺口/样式参数差异：无公开overlayBlur参数，不能称已有完整演示。 |
| `examples/modal/drag-demo.vue` | E58 | 缺口：现有高层Modal无draggable契约。 |
| `examples/modal/dynamic-demo.vue` | E58 | 部分：可更新标题/fullscreen/confirmLoading等公开props；draggable/placement/整层loading等额外参数不在现有子集。 |
| `examples/modal/form-modal-demo.vue` | E58 | 已有基础组合：现有useSchemaForm与高层Modal/Drawer组合；保留单owner/关闭租约。 |
| `examples/modal/in-content-demo.vue` | E58 | 缺口/行为差异：高层未暴露同等内容定位；open &&关闭卸载子树，无destroyOnClose:false实例保留。外层保留值不等于DOM保活。 |
| `examples/modal/nested-demo.vue` | E58 | 部分：可用现有弹窗栈/队列；其导入的拖拽子例仍缺口。 |
| `examples/modal/shared-data-demo.vue` | E58 | 已有基础组合：可用React props/回调共享数据；不承诺Vben数据工厂。 |
| `examples/modal/typed-data-auto-demo.vue` | E58 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/modal/typed-data-contract.ts` | E58 | 共享类型及泛型工厂支撑：React有类型props/回调组合已有；Vben预绑定typed composable工厂形式不复制，不宣称底层类型安全缺失。 |
| `examples/modal/typed-data-explicit-demo.vue` | E58 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/modal/typed-data-factory-demo.vue` | E58 | 已有React类型安全组合：有类型props/回调可传递和呈现数据；Vben命令式API自动推导/预绑定工厂形式不同，不把形式差异当类型安全缺失。 |
| `examples/vxe-table/table-data.ts` | E63, E70 | 支撑数据/类型：复用所属主项；不独立建页，也不新增能力。 |

### 关联路由补充（不计入107文件）

以下来自同一demos路由定义，组件在所给目录外或为框架入口；列出以免遗漏菜单中的演示。

| 编号 / 路由 | Vben入口 | 现有能力 / 拟页 | 边界 |
| --- | --- | --- | --- |
| R01 `/demos/fallback/403` | 403；playground/src/views/_core/fallback/forbidden.vue | @niubu/common-ui/system-state:SystemStatePage；@niubu/layouts/routing:RouteErrorBoundary；系统状态/基础页面壳 | 现有props可呈现标题/code/icon/actions；无同版插画/离线检测承诺，异常与断网不混同。 |
| R02 `/demos/fallback/404` | 404；playground/src/views/_core/fallback/not-found.vue | @niubu/common-ui/system-state:SystemStatePage；@niubu/layouts/routing:RouteErrorBoundary；系统状态/基础页面壳 | 现有props可呈现标题/code/icon/actions；无同版插画/离线检测承诺，异常与断网不混同。 |
| R03 `/demos/fallback/500` | 500；playground/src/views/_core/fallback/internal-error.vue | @niubu/common-ui/system-state:SystemStatePage；@niubu/layouts/routing:RouteErrorBoundary；系统状态/基础页面壳 | 现有props可呈现标题/code/icon/actions；无同版插画/离线检测承诺，异常与断网不混同。 |
| R04 `/demos/fallback/offline` | 离线页面；playground/src/views/_core/fallback/offline.vue | @niubu/common-ui/system-state:SystemStatePage；@niubu/layouts/routing:RouteErrorBoundary；系统状态/基础页面壳 | 现有props可呈现标题/code/icon/actions；无同版插画/离线检测承诺，异常与断网不混同。 |
| R05 `/demos/outside/iframe/vue-document` | Vue；iframe | @niubu/access:resolveAccess；PG私有Embedded适配（非包导出）；外部内容/本地iframe机制 | 固定容器/权限撤销已有；无DOM保活，外站CSP/嵌入效果未验证，不为演示擅自放宽sandbox。 |
| R06 `/demos/outside/iframe/tailwindcss` | Tailwindcss；iframe | @niubu/access:resolveAccess；PG私有Embedded适配（非包导出）；外部内容/本地iframe机制 | 固定容器/权限撤销已有；无DOM保活，外站CSP/嵌入效果未验证，不为演示擅自放宽sandbox。 |
| R07 `/demos/outside/external-link/vite` | Vite；external | @niubu/access:resolveAccess；@niubu/menu-ui:TreeNavigation；外链/安全新窗口 | 显式openInNewWindow=true；HTTP(S)及noopener/noreferrer约束保留，未访问外站。 |
| R08 `/demos/outside/external-link/vue-use` | VueUse；external | @niubu/access:resolveAccess；@niubu/menu-ui:TreeNavigation；外链/安全新窗口 | 显式openInNewWindow=true；HTTP(S)及noopener/noreferrer约束保留，未访问外站。 |

### 缺口与用户可选做法

1. **验证码4种、数字动画、图片裁剪、结构化JSON查看器、通用Motion、VResize、Tiptap**：无对应成品；默认保留缺口、不建页、不装依赖。可另行决定新增能力范围与依赖授权。
2. **Tippy/省略文本/Loading/ColPage**：只有邻近基础或设计不同的组件。可确认现有字符串Tooltip、ReadState/路由进度、已有外框；不能把取消登记、静态文字/布局或原生滚动当完整高级能力。
3. **VXE整组**：没有vxe-table库/API。可选择用现有DataTable示范基础/自定义cell/列固定/查询/远程；行内编辑、固定表头、树、已读追踪、虚拟化与VXE工具条缺口保留。不得以分页、普通rows.map或导航树冒充虚拟/树表。
4. **表单**：可确认11种基础字段、同步校验、纯联动、单向DTO、已有API/布局/查询/提交失败聚焦。跨owner合并、独立折叠、自动标签测宽、数组行管理、异步schema、远程搜索/树控件、双向codec等缺口不默认补。`auto`标签宽度目前表示顶部，focus不是平滑scrollIntoView。
5. **菜单/路由/标签**：保留现有角色/codes/scope、文本badge、静态链面包屑、新窗口和标签基本操作；菜单可见但403、activeIcon、任意菜单query、dot/颜色、动态标签标题/按route限额/DOM保活等按表区分。新增合成演示数据不等于修改认证策略；不把数据cache当React实例保活。
6. **请求/Query/水印/下载/剪贴板**：只按已有公开契约示例。长整数无损JSON、四种序列化预设、高级水印和通用浏览器工具封装保持缺口；React Query已在app依赖中，不能照搬Vue import。仅演示安全读的重试，query key带身份/scope/generation；现有RequestOutcome失败需要明确转异常才能触发Query重试。

7. **弹窗/抽屉高级契约**：受控、fullscreen、confirmLoading、alert/confirm及React类型安全组合可示例；拖拽、四向/内容容器、整层loading/lock、动画完成通知、关闭后实例保留、prompt及程序式beforeClose服务契约不默认补。

**本次已确认范围**：先做“已有”及“部分”栏中明确列出的现有子集，并把“缺口”全部保留。任何新第三方依赖仍无授权；如需登记尚未声明的内部workspace引用，也先明确确认，不借转导出绕过依赖边界。

### 当前边界与后续门禁

用户确认原话：“确认，先做已有能力和部分能力里的现有子集，缺口先保留。恢复模板写入通道，需要提权就申请，继续完成2-3，验收通过后合并本地master，不推送。”

本轮只在模板实现现有能力示例，不同步业务仓。公共packages/internal无必要改动时保持不变；如有则独立提交。组件交互、类型/lint/format与冷全量检查及独立审查按执行计划进行；视觉由用户pnpmdev验收，无浏览器/E2E、Docker、远端CI或生产验证。

## 实施索引

所有入口位于已登录 north/south 工作空间的 `Playground Examples` 菜单，权限沿用 `demo:read`；标签详情由 A/B 链接进入；导航的4个隐藏示例也有真实静态loader，新窗口和隐藏详情可直接访问并通过现有标签controller关闭。角色/请求/表格/Query/偏好使用明确合成fixture，独立于当前账号与业务数据。

| 页面 | 确认项 / 场景 | 源码 |
| --- | --- | --- |
| `/examples/forms` | E43/E44/E46/E47/E48/E51/E52/E53/E54：9个场景切换、11字段、API、布局、renderer、derive、查询、校验、focus、DTO | [FormsPage](../../apps/playground/src/examples/forms/FormsPage.tsx) |
| `/examples/tables` | E63/E64/E67/E68/E69：read/list/selectable、自定义cell、列偏好、query/reset/reload/cancel | [TablesPage](../../apps/playground/src/examples/tables/TablesPage.tsx) |
| `/examples/components` | E33/E38/E61：按钮、单/多选、条件上下文菜单与字符串Tooltip | [ComponentsPage](../../apps/playground/src/examples/components/ComponentsPage.tsx) |
| `/examples/feedback` | E41/E57/E58；R01–R04：受控Modal/Drawer、typed数据与表单、fullscreen、confirmLoading、队列；读取/静态系统状态 | [FeedbackPage](../../apps/playground/src/examples/components/FeedbackPage.tsx) |
| `/examples/access` | E01/E02/E03/E05/E06：合成角色admin/super/user、codes any/all与scope授权边界 | [AccessPage](../../apps/playground/src/examples/application/AccessPage.tsx) |
| `/examples/navigation` | E07/E08/E09/E10/E11/E15/E16/E21/E29–E32；R05–R08：激活树、文本/数字徽标、静态面包屑与隐藏详情/返回、嵌套/安全新窗口/本地iframe撤权 | [NavigationPage](../../apps/playground/src/examples/application/NavigationPage.tsx) |
| `/examples/browser` | E12/E14/E17/E27：合成配置复制、根文档全屏、显式图标与文本水印 | [BrowserFeaturesPage](../../apps/playground/src/examples/features/BrowserFeaturesPage.tsx) |
| `/examples/requests` | E13/E19/E20/E23：重复query、安全URL工具、Blob元数据及现有保存adapter、独立auth续期失败/恢复 | [RequestFeaturesPage](../../apps/playground/src/examples/application/RequestFeaturesPage.tsx) |
| `/examples/query` | E26及四支撑场景：分页/安全GET重试/并发缓存/infinite，identity/scope/generation key与卸载取消 | [QueryPage](../../apps/playground/src/examples/features/QueryPage.tsx) |
| `/examples/preferences` | E22：隔离typed业务扩展、预设/响应式/重置 | [PreferencesPage](../../apps/playground/src/examples/features/PreferencesPage.tsx) |
| `/examples/tabs` 与 `/examples/tabs/:id` | E24/E25：现有controller/RouteFrame、实体身份、refresh/close/pin与隔离容量模型；不保留DOM实例/动态标题 | [TabsPage](../../apps/playground/src/examples/application/TabsPage.tsx) |

35支撑文件沿上方主项归属：弹窗/抽屉共享typed props、表单与动态标题/fullscreen/确认按钮禁用、长内容滚动与队列可体验；内容容器/关闭保留/drag/blur/工厂高级协议不实现。VXE数据只用于现有DataTable，数组/JSONViewer等缺口支撑不另建能力。R05/R06仅本地iframe机制，不访问Vue/Tailwind外站；R07/R08仅安全外链，不声称已访问。

日期范围复合值的演示使用公开 `form.setValue` 整体赋值；没有修改底层叶子patch行为。所有其他缺口按上表逐项保留，不以临时app代码补造成公共API。
