# Template Playground

独立模板的标准前端示范。首页 `/home` 可匿名访问；`/login` 使用合成演示账号。工作空间菜单、权限码、按钮、外链与嵌入示例使用公共 access/session/request/布局能力，页面 URL 和 loader 始终由代码登记。

公开合成账户、权限范围与 DTO 统一见 [backend-mock README](../backend-mock/README.md)，不使用真实凭据。

`pnpm dev:playground` 提供 `127.0.0.1:5174`，自动等待当前启动器拥有的 mock `127.0.0.1:5320` 就绪；关闭与重启会等待其清理。端口已被占用会明确失败，不复用或关闭外部进程。`VITE_BACKEND_MOCK=0 pnpm dev:playground` 禁用自动 mock；单独 `pnpm dev:backend-mock` 的进程由启动者管理。

main 显式创建 auth request/adapter/session，先恢复权威用户，再建立该身份的 stores/preferences/i18n/QueryClient/API/theme/Router。普通登录、登出、换人整页刷新；scope 切换原位撤销旧请求与权限，同人过期重登保留当前页和输入。正常 token refresh 保持当前 generation，只重放一次允许重放的请求。HTTP401 加明确过期码才续期。

Bearer 存储归本 app adapter，使用 `playground.auth.v1` 与独立的禁止自动恢复标记。输入编辑、重提、卸载和启动取消均会使迟到操作失效。cookie 适配器不需要提供 token，公共 owner 的注入测试覆盖该接口；本 app 的开发服务仍演示 Bearer，不代表生产认证验收。

偏好 namespace 为 `playground`、appId=`template-playground`，身份使用服务端恢复的用户 id。classic 主题脚本只读取独立公开视觉 hint，不读取 token；它不能授予权限，运行时也不会以 hint 决定真实身份。登出清身份的内存 owner/查询/标签，保留持久化主题等用户偏好。

后端只提供稳定页面 id 或菜单元数据。未知 id 跳过并保留 diagnostics，未授予页面显示403；重复/未知 URL scope 不回退授权。iframe 使用固定代码容器 `/embedded/:menuId`，scope 撤权后卸载；外链新窗口使用 `noopener noreferrer`。

根 `pnpm dev` 自动选择本前端，也可使用 `pnpm dev --app @niubu/playground`。`pnpm preview --app @niubu/playground` 提供已有构建产物，不启动开发 mock；生产需实际 API 后端。

单包分别执行 `pnpm --filter @niubu/playground test`、`pnpm --filter @niubu/playground typecheck`、`pnpm --filter @niubu/playground lint`、`pnpm --filter @niubu/playground build`；根 `pnpm test:integration` 用注入 fetch 与内存 dispatcher 验证组件集成，不启动服务、不运行浏览器或E2E。根 `pnpm test` 同时覆盖该组件项目及各 workspace 测试。

## 显式 HTTP 运行检查

从仓库根目录执行；第一次成功并关闭后，再执行同一命令，验证相同端口可重新绑定并再次清理：

```sh
VITE_BACKEND_MOCK=1 pnpm verify:playground
VITE_BACKEND_MOCK=1 pnpm verify:playground
```

[运行入口](../../internal/scripts/src/playground-runtime.ts) 仅检查前端 HTML 与 Vite 代理的 health/echo，不涉及浏览器渲染、登录或业务操作，不加入默认 check/test/CI。启动及所有 HTTP 操作共用 30 秒截止时间；finally 只清理自己创建的 owner，成功路径也必须等待 `owned server.close()` 完成才报告 `cleaned: true`。任何断言、超时或关闭失败均不算通过。上述命令不表示已经真实运行或验收；完整协议和证据要求见[工程指南](../../docs/guide/engineering-deploy.md)。

模块、鉴权和表单的接入规范见[开发指南](../../docs/guide/README.md)，运行与产物约束见[工程与部署](../../docs/guide/engineering-deploy.md)。源码与注入测试不代表浏览器、无障碍人工、生产或用户最终验收。
