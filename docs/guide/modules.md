# 模块登记

标准入口是 [systemModule](../../apps/playground/src/modules/system.tsx)，汇总入口是 [modules/demo.tsx](../../apps/playground/src/modules/demo.tsx)。类型由 `@niubu/types` 导出，实际契约见 [DomainModule](../../packages/@core/base/typings/src/module.ts)。

`DomainModule<M, C>` 有六个必填字段：`id`、`routes`、`menus`、`permissions`、`namespaces`、`loaders`。`routes` 使用 `RouteMeta`；菜单项是 `{ pageId, parentId? }`；loader 是静态路径键对应 `() => Promise<{ Component: C }>`，不是后端给出的模块地址。系统模块的 `permissions: []` 不代表没有权限校验：页面 `requiredCodes` 和动作权限在路由与页面分别检查。

## 新增步骤

1. 在 app 内建页面和必要的 API/schema。标准列表编辑沿用 [ResourcePage](../../apps/playground/src/system/ResourcePage.tsx) 与 [ResourceEditor](../../apps/playground/src/system/ResourceEditor.tsx)，不复制一套请求客户端。
2. 在 `src/modules/` 导出模块对象。模块 `id` 与 route `id` 全局唯一；route `id` 即稳定 pageId，例如 `playground.system.users`。URL `path` 和可选 `view` 是路由身份，改文案不要顺带改 pageId。
3. 填写 `titleKey`、`iconToken`、`order`、`navigation`、`scope`、`capability` 与所需 `requiredCodes` 等实际 `RouteMeta` 字段。菜单引用代码中已有 pageId；不能用菜单标题或后端 URL 代替身份。
4. 给每条页面路径登记静态 loader，沿用 `'/system/users': async () => ({ Component: (await import('../system/UsersPage')).UsersPage })` 的写法。后端只能选择代码拥有的页面，不能下发 import、组件、任意执行地址或覆盖路径与加载器。
5. 把模块加入 app 的 `createModuleRegistry([...])`。当前 playground 在 `modules/demo.tsx` 汇总；[router.tsx](../../apps/playground/src/router.tsx) 将 `registry.routes/loaders` 交给 `createRoutes`，不要另建并行路由清单。
6. 为实际使用的 namespace 登记 app 语言入口、双语言资源与 key/插值参数；示例见 [locales/index.ts](../../apps/playground/src/locales/index.ts)。推荐 `appNamespaces + loadMessages(locale, signal)` 在启动/切换时完整准备目标语言，页面不再单独等待文案；旧 `appLoaders` 同步中文 fallback 接法保持兼容。模块的 `namespaces` 声明不能代替资源加载，不能覆盖公共 `common/validation/shell` namespace。
7. backend 模式同步后端菜单 pageId 与动作 codes；按钮使用对应 write code，页面直达仍经过 Guard。按[工程命令](./engineering-deploy.md)跑受影响包、locale、workspace/boundary 检查，收尾保留 Root 与完整检查。

[createModuleRegistry](../../packages/effects/access/src/module-registry.ts) 拒绝重复 module id/pageId/路由身份、冲突 loader、未知菜单页面与 parentId。它汇总并冻结 routes/loaders/menus/permissions/namespaces，不替 app 登录或代替后端授权。菜单与 scoped query 的边界见[鉴权与请求](./auth-request.md)。

新增模块不要求产品 app 存在；模板内直接从 playground 的 system 示例复制组织方式，再替换自己的字段、pageId、locale 与 DTO。保留既有模块契约与 Root 集成检查，不通过跳过检查接入新模块。
