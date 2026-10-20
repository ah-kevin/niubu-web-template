# 模块登记

标准入口是 [systemModule](../../apps/playground/src/modules/system.tsx)，汇总入口是 [modules/demo.tsx](../../apps/playground/src/modules/demo.tsx)。类型由 `@niubu/types` 导出，实际契约见 [DomainModule](../../packages/@core/base/typings/src/module.ts)。

`DomainModule<M, C>` 有六个必填字段：`id`、`routes`、`menus`、`permissions`、`namespaces`、`loaders`。`routes` 使用 `RouteMeta`；菜单项是 `{ pageId, parentId? }`；loader 是静态路径键对应 `() => Promise<{ Component: C }>`，不是后端给出的模块地址。系统模块的 `permissions: []` 不代表没有权限校验：页面 `requiredCodes` 和动作权限在路由与页面分别检查。

## 普通受保护页接入清单

以 [Starter 首页组件](../../apps/starter/src/modules/home.tsx)及其 [模块与 registry](../../apps/starter/src/modules/demo.tsx)查看最小接法；首页只要求 workspace 登录，额外读权限参考 [systemModule](../../apps/starter/src/modules/system.tsx)。模板内路径为 `apps/starter` 或 `apps/playground`，生成产品的目标为 `apps/web`；引用路径、产品身份和公开 scope 以目标项目为准。

1. 在目标 app 内建页面和必要的 API/schema。页面组合现有组件，公共控件视觉遵循[开发标准](./standards.md)；列表与编辑场景再按[列表接入清单](./forms-query-crud.md)检查，不复制一套请求客户端。
2. 在 `src/modules/` 导出模块对象。模块 `id` 与 route `id` 全局唯一；route `id` 即稳定 pageId，例如 `playground.system.users`。URL `path` 和可选 `view` 是路由身份，改文案不要顺带改 pageId。
3. 填写 `titleKey`、`iconToken`、`order`、`navigation`、`scope`、`capability` 与所需 `requiredCodes` 等实际 `RouteMeta` 字段。菜单引用代码中已有 pageId；不能用菜单标题或后端 URL 代替身份。
4. 给每条页面路径登记静态 loader，沿用 `'/system/users': async () => ({ Component: (await import('../system/UsersPage')).UsersPage })` 的写法。后端只能选择代码拥有的页面，不能下发 import、组件、任意执行地址或覆盖路径与加载器。
5. 把模块加入 app 的 `createModuleRegistry([...])`。当前 playground 在 `modules/demo.tsx` 汇总；[router.tsx](../../apps/playground/src/router.tsx) 将 `registry.routes/loaders` 交给 `createRoutes`，不要另建并行路由清单。
6. 为实际使用的 namespace 登记 app 语言入口、双语言资源与 key/插值参数；示例见 [locales/index.ts](../../apps/playground/src/locales/index.ts)。推荐 `appNamespaces + loadMessages(locale, signal)` 在启动/切换时完整准备目标语言，页面不再单独等待文案；旧 `appLoaders` 同步中文 fallback 接法保持兼容。模块的 `namespaces` 声明不能代替资源加载，不能覆盖公共 `common/validation/shell` namespace。
7. backend 模式核对目标 app/profile 的后端菜单 pageId、允许导航的页面及读写 codes；页面 `requiredCodes` 配读权限，按钮检查相应 write code，直达仍经过 Guard，服务端负责最终授权。菜单隐藏不能替代路由检查。账号与资源 CRUD 的 mock 边界见[新产品起步](./product-start.md)。
8. 检查目标 app 的样式入口。当前 [Starter CSS](../../apps/starter/src/styles/index.css)使用 `source(none)` 和显式 `@source`，新增目录需纳入扫描；专用非 utility CSS 还需按公开入口导入，扫描不会代替 `@import`。测试文件不作为生产样式来源，不以绕过排除规则补齐缺失类名。
9. 使用 app 已有的 auth、QueryClient、i18n、stores 等 owner；参照[启动入口](../../apps/starter/src/main.tsx)，不在模块顶层创建产品单例或第二套运行时。页面自己持有的监听、请求和资源在关闭/卸载时清理，异步结果遵守[请求与 lease 边界](./auth-request.md)。
10. 按[工程与验证说明](./engineering-deploy.md)选择受影响的组件、Root、locale、workspace/boundary 和样式检查；核对菜单、直达、只读状态及双语资源。完整交付仍遵循[工作方式](./workflow.md)，不为接入新模块跳过既有检查。

[createModuleRegistry](../../packages/effects/access/src/module-registry.ts) 拒绝重复 module id/pageId/路由身份、冲突 loader、未知菜单页面与 parentId。它汇总并冻结 routes/loaders/menus/permissions/namespaces，不替 app 登录或代替后端授权。菜单与 scoped query 的边界见[鉴权与请求](./auth-request.md)。

没有独立产品 app 时，可以在 Playground 参考现有模块组织方式；已有产品就在自身 app 中接线。参考时替换字段、pageId、locale、DTO 和所属权限，保留既有模块契约与 Root 集成检查；不新增一套模块生成或自动注册流程。
