# 鉴权与请求

## 身份、菜单与 scope

[main.tsx](../../apps/playground/src/main.tsx) 先用 authRequest 完成权威 `auth.restore()`，再创建 identity-scoped stores、preferences、QueryClient、锁和业务请求 owner。外观 [identity-hint](../../apps/playground/src/auth/identity-hint.ts) 只供首屏提示，不能恢复登录、菜单或 codes。公开演示登录说明见 [backend-mock README](../../apps/backend-mock/README.md)。

[resolvePlaygroundAccess](../../apps/playground/src/auth/access.ts) 使用 mode、registry、后端 menu、用户 codes/roles 与当前 scope 调用 `resolveAccess`。backend 模式由后端选择稳定 pageId，代码拥有路由、loader 与排序；前端模式使用静态适配。隐藏菜单不等于阻止直达：Guard 检查页面，按钮另检查动作 code，服务端仍负责最终授权。系统页读/写分别使用 `system:<resource>:read/write`。

scope 由 [ScopeSync](../../apps/playground/src/auth/ScopeSync.tsx) 在 Router location commit 后的 effect 切换，不能在 render 中或仅点击事件中提前改授权。`switchScope` 撤销旧 grants、退休旧 signal/generation，再清旧 scope 查询和加载新 grants；[query-context](../../apps/playground/src/auth/query-context.ts) 的清理上界为 `<= previous.generation`。

过期后的同用户登录由 [auth-session](../../packages/stores/src/auth-session.ts) 恢复 prior scope 并重新获取 grants，不销毁原 identity/scope owner，dirty 与草稿保留。普通登录或换人先 reset owners 再整页 reload；登出撤销本地授权、清理并 reload 登录页。不要用更新 identityKey 的方式在原 owner 上拼接新用户状态。

## 接入独立开发 mock

mock 在独立终端以 `pnpm dev:backend-mock` 启动。Playground 默认把 `/api` 代理至 `http://127.0.0.1:5320`；`MOCK_API_URL` 可配置无凭据、无路径/query/hash 的 HTTP(S) origin，例如 `MOCK_API_URL=http://127.0.0.1:5432 pnpm dev`。这个变量只供 Vite 服务器使用，不注入浏览器运行代码。

新 app 采用同样的 Vite `server.proxy['/api'] = { target: 'http://127.0.0.1:5320', changeOrigin: false }`，公开运行配置 `apiURL` 保持 `/`，请求路径继续使用 `/api/...`。前端和后端的启动/关闭独立。跨 origin 直接配置 `apiURL` 时需要后端支持相应 CORS；默认 mock 不开放跨域，标准示例采用同源开发代理。生产 app 指向真实 API，不带 mock 后端代码。

账号、菜单、pageId、CRUD 种子和扩展 API 的替换方式见 [backend-mock README](../../apps/backend-mock/README.md)。

## 请求边界

业务代码使用 `@niubu/request` 的 `createRequestClient`，由 app 显式注入 fetch、credentialsProvider、activityReporter、errorNormalizer、getGeneration 与可选 renewal。protected baseRequest 经 [createSessionRequest](../../apps/playground/src/auth/request.ts) 绑定 auth signal；未 ready/已过期时拒绝业务请求。grant 请求必须由 adapter 的 `bindGrantRequest(baseRequest)` 接入同一受控续期协调器，不能另起不带绑定的客户端形成授权空窗。

唯一业务 HTTP 执行边界是请求包，不在页面/API adapter 中另调 fetch。auth 启动客户端和受保护客户端由 app 分工持有；静态 HTML 更新探针是显式独立的无凭据 fetch，不经过业务授权。请求规范见 [RequestSpec](../../packages/effects/request/src/types.ts)：`path/method/activity/decode` 必填，可带 `body/headers/query/signal/responseType/allowReplay`。JSON body 由 app `JSON.stringify` 并显式设置 Content-Type，不能假设客户端自动编码。

JSON wire 只接受 `{ code, data, message }`：code 必须是有限数字或非空字符串，message 为字符串，data 字段必须存在；只有 HTTP 2xx 且数字 `code === 0` 成功，字符串 `'0'` 不成功。通用 envelope 校验后由每个 `decode` 校验业务 payload。源码见 [wire-envelope](../../packages/effects/request/src/wire-envelope.ts)，app 不引入第二套 envelope。

`isAccessExpired` 只认 HTTP 401 + `ACCESS_EXPIRED`，普通 401/403 不自动续期。默认只有 GET/HEAD/OPTIONS 可 replay，一次协调续期后最多重放一次；POST/PUT/DELETE 等 unsafe write 默认不重放，续期恢复后由用户再次确认。显式 `allowReplay: true` 只用于协议已经证明幂等的操作，不全局开启。系统 CRUD 的安全读恢复及重新确认见[表单与 CRUD](./forms-query-crud.md)。

## 上传与下载

[createTransferApi(client, getContext, getSessionSignal)](../../apps/playground/src/transfers/api.ts) 是 playground 绑定，调用时必须传第三个 getter `() => auth.requestContext().signal`。虽然类型可选，缺失时 capture 返回 null、操作以 aborted 失败关闭，不会退回无 session 传输。捕获 identity/scope/generation/session signal，开始、进度、完成和取消均检查当前 lease。

`uploadChunks(source, ports, options)` 从 source 分块读取，经 begin/chunk/complete/cancel 端口上传；进度只按服务端 ACK 更新，不按本地读取字节猜测。每块 ACK 的 index 和累计 acknowledgedBytes 必须准确匹配，32,768 字节分块且每次 await 后核 lease；失败、取消或迟到结果不能发布完成。实现见 [upload.ts](../../packages/effects/request/src/upload.ts)。app 对 begin/complete 禁 replay，只有协议幂等的固定 index chunk 显式允许；过期恢复后返回 `TRANSFER_RECONFIRM`，要求重新确认原写操作。

`downloadBlob(client, spec)` 走相同请求边界，成功返回 `{ blob, filename, contentType }`；失败 envelope 不当文件保存，文件名经过 Content-Disposition 解析与清理。app 的 [saveDownload](../../apps/playground/src/transfers/save-download.ts) 管理 object URL，激活失败、延迟释放及 unmount 都要 revoke，不能将 Blob/URL 留在过期 owner。UI 示例见 [TransferDemo](../../apps/playground/src/transfers/TransferDemo.tsx)。

## 公开运行配置

[runtime-config](../../packages/@core/base/shared/src/runtime-config.ts) 的唯一结构是 `Readonly<{ schemaVersion: 1; apiURL: string }>`；`apiURL` 仅允许 `/` 或没有凭据、非根路径、query、hash、控制字符的 HTTP(S) origin。未知键、非法版本与缺失配置失败关闭，不回显原始坏值。app 经 [readRuntimeConfig](../../apps/playground/src/runtime-config.ts) 调 `resolveRuntimeConfig`，在创建请求 owner 前固定 apiBaseURL。

`_app.config.js` 的精确字节为 `globalThis.__APP_RUNTIME_CONFIG__=` + 固定键序 JSON `{schemaVersion,apiURL}` + `;\n`。只通过 `validateRuntimeConfig/serializeRuntimeConfig/parseRuntimeConfigScript` 处理；它不是任意可注入 JS，不承载 token、口令、identity、appId 或存储空间。部署允许的单文件变更和封印见[工程与部署](./engineering-deploy.md)。

## 本地锁与更新

`createLocalLock({ identity, storage, crypto? })` 按 storageNamespace/appId/environment/identityKey 隔离，只保存 PBKDF2/SHA-256 派生 hash、随机 salt 与 locked 状态，不保存明文。`lock/unlock` 都接收 password 和 AbortSignal，支持 cancel/clear/dispose；存储与密码学失败不会自动解除锁。它是本地界面锁，不能代替服务端登录。见 [local-lock](../../packages/effects/hooks/src/local-lock.ts) 与 [ShellBoundary](../../apps/playground/src/app/ShellBoundary.tsx)：锁屏遮罩保留 children，过期重登在锁屏外可交互，重登不会自动解锁。

`createUpdateChecker({ fetch, indexURL, clock, intervalMs? })` 探测同源静态 index；HEAD 仅在 405/501 时回退 GET，均 `cache: 'no-store'`、`credentials: 'omit'`、`redirect: 'error'`，不读取 HTML body。以 ETag 优先、Last-Modified 回退比较；没有 validator 是 unavailable，不能凭时间假称有更新。支持 check/setVisible/dispose，隐藏页取消探针，迟到结果被丢弃。见 [check-updates](../../packages/effects/hooks/src/check-updates.ts)。app 只提示 available；显式 reloadPage 遇 dirty 或 locked 拒绝刷新，不自动 reload。以上接线见 playground 源码；生产后端与浏览器交互仍需各自验证。
