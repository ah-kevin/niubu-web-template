# @niubu/request

实例化请求客户端，通过 source exports 提供三个入口：

- `@niubu/request`：`createRequestClient` 及 `RequestClient`、`RequestSpec`、`RequestError`、`RequestOutcome`、`RenewalPolicy`、`EnabledRequestOptions` 类型。
- `@niubu/request/protocol`：纯 Node 兼容的 `ACCESS_EXPIRED_CODE` 与 `isAccessExpired`；后端无需导入浏览器 transport。
- `@niubu/request/disabled`：`createDisabledRequestClient({ mode: 'disabled' })`。该窄入口不导入 enabled transport；`execute` 返回 `not-enabled`，不调用 fetch。适用于显式禁用请求的调用方；playground 使用启用客户端，接线见 [auth/request.ts](../../../apps/playground/src/auth/request.ts)。

启用实例必须显式注入 `baseURL`、`fetch`、`credentialsProvider`、`activityReporter`、`errorNormalizer` 和 `getGeneration`。没有全局凭据或通用重试；请求路径不能逃出注入的 origin。只有 foreground 请求报告活动，background 请求不延长会话。

可选续期策略明确判断 `shouldRenew` 并执行 `renew(signal)`，同代并发续期合并为 single flight。GET、HEAD、OPTIONS 默认允许续期后的单次重放；其它方法默认不重放，调用者须通过 `allowReplay` 明确声明。普通 401/403 不自动触发续期。

`getGeneration` 是被动 getter，不订阅身份变化。新 `execute` 和异步完成检查会拒绝旧代结果，但仅改变 getter 返回值不会立即唤醒挂起请求。身份切换或销毁的 owner 必须主动 abort 对应请求，或调用 `client.dispose()` 取消全部等待及续期；已经 dispose 的实例不能复用。请求取消与 dispose 会使等待者 settle，即使注入的异步依赖忽略 signal。调用者同时负责传入 `AbortSignal` 和用 `decode` 验证业务数据。

验证位于本包的 `client.test.ts`、`renewal.test.ts`，使用注入的 fetch/Response；它们不代表真实服务、认证或后端协议已经接入。

`RequestSpec` 原样转发原生 `body`，合并大小写无关的 `headers`（credential provider 优先），接受 `query` 的 URLSearchParams 或 primitive/数组 record。调用者显式 `JSON.stringify` 和 Content-Type；数组编码为重复 query，null/undefined 省略。

唯一 wire 格式为 `{code,data,message}`，三个字段均必需；只有 HTTP 2xx 且数字 `code === 0` 成功。错误 code 归一化为 string，message 原样保留，追踪标识只读响应头 `X-Request-Id`/`X-Trace-Id`。旧 data-only、坏 JSON、字符串 `'0'` 均不能成功。明确过期约定为 HTTP401 + `ACCESS_EXPIRED`；`isAccessExpired` 可注入 shouldRenew，普通401/403不续期。
