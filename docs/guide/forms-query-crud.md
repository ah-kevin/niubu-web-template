# 表单、查询与 CRUD

| 选择                                            | 适用场景                                     | 入口                                                                       |
| ----------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| 底层 RHF + Zod + `ControlledField`/`FieldShell` | 特殊布局、复杂交互、需要显式控制字段生命周期 | [form exports](../../packages/effects/common-ui/src/form/index.ts)         |
| 上层 `useSchemaForm`                            | 标准配置表单、联动、分组、查询条件、统一提交 | [system/form-schemas.ts](../../apps/playground/src/system/form-schemas.ts) |

## 单 owner 与字段扩展

`useSchemaForm<V, O, C>(options)` 返回 `SchemaFormApi<V, O, C>`。默认输出 `O = DeepPartial<V>`，明确 DTO 则提供 `transform(visibleValues)`。`form` 是唯一 RHF owner，`Form` 与 `Fields` 的组件身份稳定；`fields/defaultValues/schema/customFields` 初始化一次，之后字段变化使用 `updateFields`，不要靠每次重建 options 重置表单。接口见 [schema-types.ts](../../packages/effects/common-ui/src/form/schema-types.ts)。

普通页面可渲染 `<schema.Form />`；已有 `FormFrame form={schema.form}` 时只嵌 `<schema.Fields />`，避免嵌套 form 和两个提交 owner。系统编辑实际采用后一种写法，见 [ResourceEditor](../../apps/playground/src/system/ResourceEditor.tsx)。`setValues(patch, { shouldDirty })` 用于非敏感草稿恢复；重置使用 `reset`。

固定内建控件为 `text`、`textarea`、`number`、`password`、`select`、`checkbox`、`checkbox-group`、`radio`、`switch`、`date`、`date-range`。映射由 [registry.ts](../../packages/effects/common-ui/src/form/registry.ts) 固定。app 扩展只用 `custom:<name>` 与有类型的 `customFields` renderer，接收 `field/fieldState/shell/params/disabled`；不能覆盖内建 kind，需保留 RHF 绑定、focus/ref 与可访问性属性。

字段 `dependencies.fields/derive` 必须同步、纯计算；可改变 visible/disabled/required/schema/componentProps。Zod 校验仅同步，拒绝 async refinement 与改变值类型的 schema transform。字段输入保持原有类型，UI 值到 DTO 的类型转换放在显式 `transform`；不要让校验偷偷改变保存数据。

## 隐藏、敏感与公开投影

| API                                    | 实际语义与用途                                                             |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `getValues(): V`                       | 原始值，只供受控交互和提交过程读取；可能有密码和隐藏值                     |
| `toOutput(values): O`                  | 仅投影可见字段再调用 DTO transform；可包含可见密码/敏感值，只用于提交      |
| `publicValues(values): DeepPartial<V>` | 仅可见且非敏感字段，供必要的公开预览；不是完整 V                           |
| `filterDraft(values): DeepPartial<V>`  | 去掉 password/sensitive 字段，保留已配置、类型合法的隐藏非敏感值，便于恢复 |

这是 `publicValues` 接口，没有 `publicFields`。`kind: 'password'` 或 `sensitive: true` 都视为敏感；隐藏字段不进入当前输出/公开预览，disabled 的可见值仍参与校验与输出。嵌套投影返回 DeepPartial，不能断言为完整对象。实现见 [useSchemaForm](../../packages/effects/common-ui/src/form/useSchemaForm.tsx) 与 [transforms](../../packages/effects/common-ui/src/form/transforms.ts)。

禁止把 `getValues`、`toOutput` 的结果放入日志或自动 review。自定义 review 只挑选 `publicValues` 的必要字段；不能 stringify 整个 DTO。接入 `FormFrame` 时显式传 `draftFilter={schema.filterDraft}`；公共投影也不表示数据可以无条件记录。

## Query 与表格

`useQueryDataTable<V, Q, R>` 从 `@niubu/common-ui/data-table` 导出，接收 `queryForm`、`load({ query, pagination, sorting, signal })`、`scopeKey`、`enabled`、可选 `initialPageSize`，返回 `queryForm/tableState/query/reset/reload/cancel`。实际类型见 [query-types](../../packages/effects/common-ui/src/data-table/query-types.ts)。

`query()` 校验当前表单、生成 Q 并回第一页；`reset()` 重置条件再查询；`reload()` 重载已应用条件与当前页，不把尚未应用的编辑当查询；`cancel()` 退休当前验证与请求。排序、pageSize 改变回第一页，删除后页码越界只回退一次。`scopeKey` 必须包含 identity、scope、generation，`enabled` 只在实际可读时为 true。控制器用 epoch/signal 丢弃迟到结果，不能只在发请求前判断一次。

系统列表的 [ResourcePage](../../apps/playground/src/system/ResourcePage.tsx) 将 `tableState` 交给 `DataTable profile="list"`，通过 QueryClient 接入缓存。query key 用 [playgroundScopeQueryKey](../../apps/playground/src/auth/query-context.ts)：namespace、identity、scope kind/id、generation 后接资源与条件。合并 wrapper/session/Query signal，重复查询前取消旧 exact key，防止去重到已取消读。旧 scope 清理仅清 `generation <= previous.generation`，不能把重新进入该 scope 的新查询一起删掉。

### 完整树列表

菜单、部门使用 `DataTable profile="tree-list"`；用户、角色继续使用分页列表。树 profile 接收完整 client 层级结果的根节点、`getSubRows`、`treeColumnId` 和 `getRowLabel`，列用 `createTreeColumnHelper` 定义。原生 TanStack 行模型负责展开，不传分页，也不在 app 里手工截取可见行。`resultCount` 是当前结果的全部层级节点数，不是根节点数；`sourceCount` 是完整来源节点数。非 ready 状态仍必须清空行并保持未知计数。

`expanded` 沿用 `SliceOwner<ExpandedState>`，支持内部或受控 owner；刷新和过滤时允许保留暂未出现在当前结果中的展开 ID。身份、scope 与资源变更由 app 隔离。层级列不能隐藏；按钮提供展开状态和行名称，只有箭头按钮切换，普通文字与行操作不会触发展开。完整示例见 [TablesPage](../../apps/playground/src/examples/tables/TablesPage.tsx)，系统接入见 [ResourcePage](../../apps/playground/src/system/ResourcePage.tsx)。

`system.menus.tree(context, signal)` 和 `system.departments.tree(context, signal)` 请求原 collection 的 `mode=tree`：参数仅 scope 与 mode，响应为 `{ rows, rowCount, complete: true }` 的单次完整 flat 快照。不要循环拼分页，也不要把过滤后的子项当完整来源。decoder 验证记录、总数、唯一 ID、父节点和环；app 用根数组与 children 索引保持原 DTO 引用，过滤结果保留必要祖先。现有 `list` 协议保持，用户和角色没有 `tree` 端口。

新增下级沿用原编辑器与写入端口，父级作为初始值，并将创建草稿按父节点隔离。父级选择排除自身与后代；有子项不能删除，服务端继续校验依赖，不能改为隐式级联删除。成功后重载完整快照并保持必要展开路径，焦点恢复仍须检查 owner、请求代次、当前活动控件和弹层。

## 系统 CRUD、dirty 与 late leases

[createSystemApi(client, getContext)](../../apps/playground/src/system/api.ts) 提供 `users/roles/menus/departments` 四个端口，各含 `list/get/create/update/remove`；签名和输入见 [contracts.ts](../../apps/playground/src/system/contracts.ts)。端口接收 captured `AuthContext` 与可选 signal，经唯一请求客户端发起调用、校验 DTO 和响应；页面不直接 fetch。

编辑流程沿用 [form-schemas](../../apps/playground/src/system/form-schemas.ts) → [ResourceEditor](../../apps/playground/src/system/ResourceEditor.tsx) → [resource-runtime](../../apps/playground/src/system/resource-runtime.ts)。列表 detail/edit/remove、lookup、提交与 invalidation 的 await 前后都检查 lease。`sameOwner` 比 identity/scope；`currentLease/requireLease` 还比 generation 和 signal。迟到响应不能覆盖新 editor、关掉新弹窗、宣布保存成功或污染新 scope 缓存。

`FormFrame` 管校验、确认、pending、dirty、草稿和取消；`operationKey` 使用 schema.configVersion 与 auth generation/status/loginExpired，owner 或配置改变就取消旧操作。普通行内重渲染不重启保存；编辑、reset、cancel、关闭或卸载让旧 operation 失效。真实取消入口通过 `onCancelReady` 注册给 Modal/Drawer，dirty 时走原有离开确认，不直接卸载抹掉草稿。

同用户过期重登保留 identity/scope owner 和 dirty 表单，更新 generation 并重新获取授权；写入必须重新确认。`writeWithRecovery` 在 unsafe write 得到 ACCESS_EXPIRED 后发安全 list 读触发恢复，再抛 `ReconfirmSystemWrite`，不会重放原写入。成功才 invalidate 对应资源，且 invalidation 后仍检查 lease。失败保留输入，显示权限/冲突/记录丢失等错误。身份与请求细节见[鉴权与请求](./auth-request.md)。
