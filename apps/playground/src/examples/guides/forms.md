# 表单示例使用指南 / Form examples

表单页的九个场景只使用已有公共能力；数据均为合成。源码入口：`apps/playground/src/examples/forms/FormsPage.tsx`。仓库完整指南位于 `docs/guide/forms-query-crud.md`。

- E43：`useSchemaForm` 拥有唯一表单；`getValues` 读取原值，`setValues` 更新原值，`form.reset` 重置；`validate/submit/cancel` 管理操作租约，`updateFields` 只更新已登记字段并退休当前操作。
- E44：11种内建字段；公开预览排除合成密码。
- E46：列数/colSpan 和一个 Form 内的 JSX 分区。
- E47：`ControlledField` 与 app-local typed renderer 保留字段 ref、错误描述和绑定。
- E48：既有字段同步纯 derive；隐藏值保留在原值中，输出投影排除隐藏字段。
- E51：查询 DTO、整体条件展开/收起、重置与重新查询。
- E52/E53：同步 Zod 校验；提交失败展开错误行并聚焦可见错误，不承诺平滑滚动。
- E54：`getValues` 为原值，`toOutput` 为单向 DTO；`setValues` 不解码 DTO。

字段、schema 与 custom registry 初始化一次。示例通过现有 ControlledField 呈现实时语言；切换语言不重建 owner，不调用 updateFields 来取消 pending 保存。

缺口保留：数组行引擎、跨 owner 合并、独立字段/分组折叠、标签自动测宽、异步 schema、远程搜索/树控件和双向 codec。日期范围复合值通过公开 form.setValue 整体赋值。

These scenes demonstrate existing public form APIs and one form owner. Locale changes keep values and active operations. Missing Vben contracts remain deferred; no additional dependencies are installed.
