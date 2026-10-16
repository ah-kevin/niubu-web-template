# 结构与命名

| 目录                           | 职责                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `apps/playground`              | 标准示范 app：显式 owner 初始化、模块、鉴权、系统 CRUD 和传输页面 |
| `apps/backend-mock`            | 仅开发与测试使用的假后端；不是生产服务                            |
| `packages/@core/base/*`        | 类型、纯工具、设计与偏好基础                                      |
| `packages/@core/ui-kit/*`      | UI 原语与布局、菜单组件                                           |
| `packages/effects/*`           | 请求、hooks、stores、权限、通用表单与布局等运行能力               |
| `packages/*`                   | 对 app 提供的公共入口、样式、图标、locale、偏好等包               |
| `internal/*`                   | Node 工具、构建配置、检查与 lint/test/TypeScript 配置             |
| `scripts`、`tests/integration` | 根检查编排与 Root 集成测试                                        |
| `docs/guide`                   | 开发规范；不依赖文档站或新脚手架                                  |

依赖从 app 指向公共包，较高层公共能力组合基础包；内部构建配置由开发依赖接入。包间只使用 manifest 声明的公共 exports，禁止通过相对路径穿入别的包的私有源码。公共包直接或经构建依赖闭包都不能反向依赖 app；app 也不能依赖另一个 app，playground 不能导入产品 app。不得引入环。具体检查见 [workspace-check](../../internal/scripts/src/workspace-check.ts) 与 [boundary-check](../../internal/scripts/src/boundary-check.ts)。

公共包按源码 exports 消费，不能用失真的 dist 或空占位入口让检查通过。运行时源码、测试归属、依赖与 exports 必须对应；配置包和类型包按各自职责提供实际内容。新增文件归现有包，不随意增加包或第三方库。

## 模板名与产品名

`@niubu/*`、`@niubu-internal/*` 沿用为模板包前缀，不能把它们当产品显示名。产品文案由 app 的 `appConfig.displayName`、locale 和 app 偏好默认值提供。`appIdentity` 管理 `storageNamespace`、`product`、`appId`、`environment`、`identityKey`；修改存储身份前需评估历史偏好迁移，不通过替换显示名隐式清空旧存储。

真实范例是 [app/config.ts](../../apps/playground/src/app/config.ts)：`appConfig` 定义显示名、首页与鉴权模式，`appDefaults`/`appPolicy` 定义偏好默认值与策略。配置里的 `identityKey: 'anonymous'` 只是启动默认值；[main.tsx](../../apps/playground/src/main.tsx) 在权威 restore 后用实际用户 id 初始化 owner。外观 hint 不能提供授权身份。

运行配置只改变公开 `apiURL`，不能覆盖 appId、storageNamespace 或 auth。产品字段不下沉到公共包；产品词禁入规则由根 boundary 配置检查。本仓库只有 playground/backend-mock；公共偏好保留 86 字段、15 主题与 7 布局，消费入口由 [control-schema](../../packages/effects/common-ui/src/preferences/control-schema.ts) 登记。Root 集成与完整检查继续执行，不以其他产品仓库的路由数量或验收结果代替本仓验证。

## 生命周期

[startPlayground](../../apps/playground/src/main.tsx) 持有 stores、preferences、i18n、QueryClient、请求客户端、router、锁与更新 checker，并注册 dispose。不要在公共包顶层创建带产品身份的单例或读取浏览器全局完成初始化。新增能力由 app 显式注入 fetch、storage、clock 等端口，并与 owner 一起释放。模块新增见[模块登记](./modules.md)，身份切换见[鉴权与请求](./auth-request.md)。
