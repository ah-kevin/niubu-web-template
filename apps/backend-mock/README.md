# Backend Mock

仅用于本地开发的 Nitro 2 合成后端。无数据库、真实用户、JWT、磁盘持久化或生产 build 脚本；实例内资源保留到后续请求，重启即恢复种子并清空 token。服务由独立启动者管理，默认绑定 `127.0.0.1:5320`。

## 独立启动

在仓库根目录运行：

```sh
pnpm dev:backend-mock
# 使用其他本机端口
pnpm dev:backend-mock --host 127.0.0.1 --port 5432
# 环境变量也可配置；显式命令行优先
MOCK_HOST=127.0.0.1 MOCK_PORT=5432 pnpm dev:backend-mock
```

默认绑定 `127.0.0.1:5320`。启动入口校验地址和端口，先独占检查端口再启动自己的 Nitro；占用时失败，不接管其他服务。Ctrl-C 关闭本次启动的后端进程组并等待清理。任何就绪前退出、就绪后异常退出或清理失败都报告错误。不要同时启动两个占用相同地址的 mock。

## app 接入

mock 独立运行后，另一个终端执行 `pnpm dev`。Playground 的 `/api` 开发代理默认指向 `http://127.0.0.1:5320`；后端自定义端口时使用 `MOCK_API_URL=http://127.0.0.1:5432 pnpm dev`。前端不会启动或关闭 mock。

其他 app 在 Vite 中配置 `server.proxy['/api'] = { target: 'http://127.0.0.1:5320', changeOrigin: false }`，公开运行配置 `apiURL` 保持 `/` 即可。同源代理避免跨域；默认 mock 不开放 CORS。生产构建仅交付前端静态资源，使用真实 API。

## 替换默认演示数据

[源配置](./mock.config.ts)选择一份 `MockConfig`；默认值来自 [fixtures.ts](./src/fixtures.ts)，服务逻辑在 [dispatcher.ts](./src/dispatcher.ts)，不依赖 Playground 的前端源码。编辑配置后由 Nitro 重载，也可重启独立服务。

`MockConfig` 定义在 [config.ts](./src/config.ts)：`accounts` 是合成账号及其用户/工作空间、各空间 menu/codes；`publicMenu` 是匿名菜单；`navigablePageIds` 是系统菜单 CRUD 可选页面；`systemSeeds` 提供各空间 users/roles/menus/departments 初始数据。替换整份配置可移除所有默认账号、菜单和资源；只覆盖部分字段时从 `defaultMockConfig` 展开，并显式替换相应字段。当前系统 CRUD/传输保留 `north`、`south` 两个空间 id，名称、用户、授权、菜单 pageId 与种子可替换；配置按实例快照，运行中资源修改不改变原始配置。

```ts
import type { MockConfig } from './src/config';
import { defaultMockConfig } from './src/fixtures';

export default {
  ...defaultMockConfig,
  publicMenu: [{ kind: 'page', id: 'home', pageId: 'my-app.home' }],
  navigablePageIds: [...defaultMockConfig.navigablePageIds, 'my-app.home'],
  // 这里保留原登录菜单和资源；需要时再替换 accounts 和 systemSeeds。
} satisfies MockConfig;
```

账号仅使用本地合成数据，不放入真实凭据。用户身份、空间成员关系与 codes 由这份配置决定；系统资源 CRUD 不修改认证账号或授权。账号重复、非法配置和内置接口冲突在启动时失败，不回显账号内容。

## 新增接口

在 `mock.config.ts` 的 `endpoints` 数组登记固定 `/api/...` 路径、methods、access 和 handler。handler 返回 data，dispatcher 统一包装 `{code,data,message}`、状态和 no-store；它拿到 body/query 以及经验证的 user/scope，不接收原始 Authorization。

```ts
export default {
  ...defaultMockConfig,
  endpoints: [{
    path: '/api/projects',
    methods: ['GET'],
    access: 'workspace',
    requiredCodes: ['demo:read'],
    handler: ({ user, scope }) => ({ owner: user!.id, workspace: scope!.id }),
  }],
} satisfies MockConfig;
```

`public` 为公开接口，`authenticated` 要求有效会话，`workspace` 另校验精确空间参数与全部 requiredCodes。扩展不能覆盖内置 auth/system/transfers/health/echo/user/menu 路径，重复路径和非法声明失败。请求仍受 JSON 对象及大小上限约束；新增能力用 dispatcher 单元测试验证，实际接入再执行本机 HTTP 检查。

所有 API 返回 `{ code, data, message }`，仅数字 `code: 0` 表示成功。错误 `data: null`，并携带相应 HTTP 状态。响应使用 JSON 与 `Cache-Control: no-store`，不设置跨域放行或 Cookie。

| API                      | 请求                                                                      | 成功 data                                                                                           |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/health`        | 无                                                                        | `{ status: 'ok', service: 'NIUBU_BACKEND_MOCK_ONLY_STAGE3' }`                                       |
| `GET /api/demo/echo`     | `?value=hello&query=one&query=two`，可选 `X-Demo`                         | `{ value: 'hello', query: ['one','two'], headers: {} }`                                             |
| `POST /api/demo/echo`    | JSON `{ "value": "hello" }`，可附同上 query/header                        | 同上，value 来自 body                                                                               |
| `POST /api/auth/login`   | JSON `{ "username": "demo@playground.invalid", "password": "demo-only" }` | `{ accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 300 }`                                |
| `POST /api/auth/refresh` | JSON `{ "refreshToken": "<in-memory token>" }`                            | 同登录                                                                                              |
| `POST /api/auth/logout`  | Bearer + JSON `{}`，或 JSON `{ "refreshToken": "<in-memory token>" }`     | `null`，撤销整对 token，重复调用幂等                                                                |
| `GET /api/user`          | `Authorization: Bearer <accessToken>`                                     | 当前会话的 `{ id, name, roles, workspaces: [{ kind: 'workspace', id, name }] }`                     |
| `GET /api/auth/codes`    | Bearer，可选 scope query                                                  | 当前用户在指定 workspace 的权限码，见下表                                                           |
| `GET /api/menu`          | 未登录可访问；登录后可选 scope query                                      | `BackendMenuItem[]`，匿名仅 `{ kind: 'page', id: 'home', pageId: 'playground.home', icon: 'home' }` |

两个公开合成账号为 `demo@playground.invalid` / `demo-only` 和 `second@playground.invalid` / `demo-only`，均不是真实用户凭据。`username` 直接接收用户输入的邮箱，精确匹配；不接受旧标识 `demo`，不做隐藏映射、大小写转换或空白裁剪。两个账号均属于 north/south；用户身份由已验证 session 的 `userId` 选择，不按第一账号兜底。

| 用户 id / name / roles                       | workspace | 页面与附加菜单                                                       | codes                                            |
| -------------------------------------------- | --------- | -------------------------------------------------------------------- | ------------------------------------------------ |
| `demo-user` / `Demo User` / `['admin']`      | north     | 分组内 home、request、四个 system 页面；外链、iframe、未知页面诊断项 | `demo:read`, `demo:echo` 和下述四资源 read/write |
| `demo-user` / `Demo User` / `['admin']`      | south     | 仅 home                                                              | `['demo:read']`                                  |
| `second-user` / `Second User` / `['viewer']` | north     | home 与四个 system 页面                                              | `demo:read` 和下述四资源 read                    |
| `second-user` / `Second User` / `['viewer']` | south     | 仅 home                                                              | `['demo:read']`                                  |

菜单遵循 `@niubu/types` 的 `BackendMenuItem` union。页面只提供稳定 pageId `playground.home` / `playground.request` / `playground.system.users|roles|menus|departments`，不提供页面 URL 或组件。分组 id 为 `workspace-pages`，页面项 id 为 `home` / `request`；request 带 badge `Demo`。第一账号 north 额外包含：

- external：id `documentation`，href `https://example.com/docs`，`openInNewWindow: true`。
- iframe：id `frame-demo`，src `/frame-demo.html`，不含 pageId；由 app 固定容器路由渲染，HTML 由 app 提供。
- page：id `unknown-demo`，pageId `unknown.page`，用于 app 记录诊断并跳过单项，不应让整个菜单失败。

图标仅使用显式通用 key `home`、`arrow-right-left`、`external-link`、`monitor`，app 负责登记。匿名无论指定 north/south 都只获得公共 home；request 已不属于公共菜单，external/iframe 也不对匿名返回。Echo API 使用公开标量回显协议，页面和按钮授权由 app 的 guard/access 消费菜单及 codes。

旧 `/api/menu`、`/api/auth/codes` 的 scope query 使用 `?scopeKind=workspace&scopeId=north` 或 `south`。保留未提供 scope 时默认 north 的原协议；任何未知 kind/id、不完整或重复 scope 参数均返回 `403 UNKNOWN_SCOPE`，不回退。提供了无效/过期 Bearer 的菜单请求不会退回匿名模式。用户和权限接口要求有效 access。

Token 为 opaque 内存标识；access 5 分钟到期，refresh 7 天绝对到期。刷新替换 access，复用 refresh 以便取消后的请求可以重试；refresh 不延长自身寿命，也不改变会话身份。两个账号都支持 access 或 refresh 登出，并撤销整对 token。每实例最多 128 个会话，登录会清理 refresh 已到期记录，容量满时撤销最早创建的会话。`dispose()` 清空并关闭 backend 实例。

所有 POST/PUT 都要求 JSON 对象，最大 **65536 字节**（UTF-8）；坏 JSON 为 `400 INVALID_JSON`，非对象/缺失 body 为 `400 INVALID_BODY`，超限为 `413 BODY_TOO_LARGE`。非法合成账号返回 `401 INVALID_LOGIN`。未登录/未知 access 为 `401 UNAUTHENTICATED`；已识别的 access 到期为 `401 ACCESS_EXPIRED`（直接复用 `@niubu/request/protocol`）；未知/过期 refresh 为 `401 INVALID_REFRESH`。未知路径为 `404 NOT_FOUND`，不支持的方法为 `405 METHOD_NOT_ALLOWED`。所有错误均有完整 envelope。

Echo 仅回显标量 `value`、重复的 `query` 参数和 `X-Demo`（响应键 `x-demo`）。缺失 value 返回 null；其他 query/body/header 字段全部忽略，不回显 Authorization 或 Cookie。不要把秘密放在示例字段。实现不记录密码、token、请求头或 body。

服务启动后，可用以下无敏感信息的 API 示例检查桥接：

```sh
curl --fail http://127.0.0.1:5320/api/health
curl --fail 'http://127.0.0.1:5320/api/demo/echo?value=hello&query=one&query=two' -H 'X-Demo: example'
curl --fail http://127.0.0.1:5320/api/demo/echo -H 'Content-Type: application/json' --data '{"value":"hello"}'
```

`src/dispatcher.ts` 的 `createMockBackend({ now?, randomId? })` 提供 `dispatch({ method, path, query?, headers?, body? })` 与 `dispose()`。body 可传 JSON 文本或 JSON 对象；query 可传 `URLSearchParams` 或字符串/字符串数组记录。clock 以毫秒计，randomId 默认 Node `randomUUID`，均可注入。实例不共享会话和可变响应数据。`src/fixtures.ts` 含 mock-only sentinel，用于前端生产 bundle 排除检查。

`plugins/api.ts` 显式从 `nitropack/runtime` 导入 `defineNitroPlugin`，在 Nitro 提供的 h3App `/api` 上调用同一个 dispatcher，保留原路径、重复 query 与状态。Nitro 2 先注册 router 再运行 plugin，因此 API layer 移到 router 前以避免 fallback 404 截断；不依赖虚拟全局 auto-import 或直接 h3 依赖。普通 Vitest 仅加载纯模块，不 import plugin runtime；单元测试仅验证进程内 dispatcher，不启动 Nitro；HTTP 桥接需单独运行并保存实际结果。

```sh
pnpm --filter @niubu/backend-mock test
pnpm --filter @niubu/backend-mock typecheck
pnpm --filter @niubu/backend-mock lint
```

## 系统资源（仅进程内演示）

四资源 base 为 `/api/system/users`、`/api/system/roles`、`/api/system/menus`、`/api/system/departments`。每个请求必须恰有一个 `scopeKind=workspace` 和 `scopeId=north|south`；不接收客户端 identity/generation。与旧菜单接口不同，系统资源不提供默认 workspace。缺失、未知 scope 为 `403 UNKNOWN_SCOPE`，重复/未知 query 为 `400 INVALID_INPUT`。

| Method/path       | 成功 data                           |
| ----------------- | ----------------------------------- |
| `GET base`        | `{ rows, rowCount }`                |
| `GET base?mode=tree` | `{ rows, rowCount, complete: true }`，仅 menus/departments |
| `GET base/:id`    | 完整记录                            |
| `POST base`       | 新记录（后端生成 id）               |
| `PUT base/:id`    | 全量替换可写字段后的记录（id 不变） |
| `DELETE base/:id` | `{ id }`                            |

所有成功均为 **HTTP 200 / code 0**。详情/更新/删除不存在的记录返回 `404 NOT_FOUND`；不支持的方法 `405 METHOD_NOT_ALLOWED`；验证失败 `400 INVALID_INPUT`；唯一性、引用与父链冲突 `409 CONFLICT`。错误不修改数据、不级联。未登录 `401 UNAUTHENTICATED`，已识别 access 过期仍使用共享 `401 ACCESS_EXPIRED`，不自动重放写入。

列表使用 `pageIndex=0`、`pageSize=10` 默认值，pageSize 仅接受 1–100；分页仅十进制安全整数。排序默认 id 升序，`sortOrder=asc|desc`；users 支持 name/email，roles 与 departments 支持 name/code，menus 支持 title/order；所有排序同值都按 id 升序。`keyword` 最长100字符，对 name/title 及 email/code 不区分大小写包含匹配；`enabled=true|false` 可选。users 另支持 roleId/departmentId，menus 支持 kind，departments 支持 parentId：字面量 `parentId=null` 查根部门、省略查全部、空字符串非法。详情和写操作仅接收 scope query。所有 scalar query 禁重复。

菜单与部门的 collection GET 可使用 `?scopeKind=workspace&scopeId=north&mode=tree` 读取一次完整快照。`rows` 为保留 `parentId` 的完整平面 DTO 数组，包含禁用节点；`rowCount` 等于数组长度，空集合仍返回 `complete: true`。快照在 repository 内同步读取并复制，不分页、不截断。此模式只接受各一个 `scopeKind`、`scopeId`、`mode`，且 mode 必须精确为 `tree`；分页、排序、筛选、未知及重复参数均返回 `400 INVALID_INPUT`。users/roles、详情及写操作不接受 mode。`/api/system/menus/tree` 仍表示 id 为 `tree` 的单条记录。快照沿用原会话、workspace membership 和资源 read 权限，不改变默认分页列表及写入约束。

可写 DTO（id 只在响应中出现）：

- users：`{ name, email, roleId, departmentId, enabled }`；name 1–80，email 合法且同 workspace 大小写无关唯一，roleId/departmentId 必须引用同 workspace 的现存记录。
- roles：`{ name, code, description, enabled }`；name 1–80，code 匹配 `[a-z][a-z0-9:_-]{1,63}` 且同 workspace 唯一，description 最长500。
- departments：`{ name, code, parentId, enabled }`；name/code 规则同上，parentId 为同 workspace 部门 id 或 null，禁止自指/后代循环。
- menus：`{ title, kind, parentId, order, enabled, pageId?, href?, openInNewWindow? }`；title 1–80，order 为0–9999整数，parentId 为同 workspace group id 或 null，禁止父链环。kind 仅 group/page/external，page 必须使用已登记的六个 pageId；external 仅安全 http(s) 或同源相对 href，拒绝 javascript/data/协议相对及反斜杠/控制字符。按 kind 清除不适用字段，绝不接收 path/loader/component。

POST/PUT 拒绝 id、scope、未知字段和 prototype 特殊键，不做数字/布尔值隐式转换。先完整校验后原子写入，返回独立副本。id 使用 `user-`、`role-`、`menu-`、`department-` 前缀加后端 UUID；仅含 `[A-Za-z0-9_-]`，不依赖数组下标、不生成字面量 null。种子 id 确定且带 workspace；每个 workspace 有12个 users、operator/auditor 两个 roles、根/子两个 departments、group/page/external 三个 menus，所有引用合法。每实例初始化一次，dispatch 之间保留修改；实例及 workspace 不共享可变数据，dispose 清空资源并关闭实例。

north 的固定授权菜单新增 group `system`（order 15），子菜单 `system-users`、`system-roles`、`system-menus`、`system-departments`，对应 `playground.system.users`、`playground.system.roles`、`playground.system.menus`、`playground.system.departments`。管理员和 viewer 都可导航四页，原管理员 request/external/iframe/unknown.page 诊断例保留。south 和匿名仍只显示 home。

north admin 的精确 codes 顺序：`demo:read`, `demo:echo`, `system:users:read`, `system:roles:read`, `system:menus:read`, `system:departments:read`, `system:users:write`, `system:roles:write`, `system:menus:write`, `system:departments:write`。north viewer：`demo:read`, `system:users:read`, `system:roles:read`, `system:menus:read`, `system:departments:read`。两用户 south 都仅 `demo:read`，直调系统读写均403。权限从已认证 session 的固定 fixture.codes 与 workspace membership 校验，资源中的角色/菜单记录不参与登录或授权。

这是合成演示资源，不是生产身份或组织管理。CRUD 不改固定合成账号、凭据、roles/codes 或鉴权菜单。DELETE 被用户引用的 role/department、带子部门/子菜单的记录一律409；不留下悬空引用。Nitro 仅扩展 POST/PUT 共用原65536字节读流限制、真实请求头和既有挂载层；无监听 socket 的单元/dispatcher 测试只证明进程内行为，不代表实际 HTTP、浏览器、人工或生产验收。
