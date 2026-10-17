# apps 区域规则

继承[根规则](../AGENTS.md)。

- 每个 app 在 `main.tsx` 里显式创建 stores、preferences、i18n、QueryClient、请求客户端和路由，退出时一并释放。先完成登录状态恢复，再创建与身份相关的对象。
- 新页面按[模块登记](../docs/guide/modules.md)：稳定的 pageId、静态 loader、菜单与权限码、翻译文件。
- app 之间不互相依赖。产品显示名和存储标识留在 app 配置里。
- Playground 是标准示范：新增公共能力在这里补示例。写法参考 [system 模块](./playground/src/modules/system.tsx) 和[系统 CRUD](./playground/src/system/ResourcePage.tsx)。
- backend-mock 只用于开发和测试，生产构建不能包含它。
