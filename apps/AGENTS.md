# apps 区域规则

继承[根规则](../AGENTS.md)；新增页面按[模块登记](../docs/guide/modules.md)，身份与请求按[鉴权指南](../docs/guide/auth-request.md)。

- 在 main 显式初始化并释放 owner；权威 restore 先于 scoped owners，Router commit 后切换 scope。
- 模块登记稳定 pageId、静态 loaders、菜单/codes 与 locale；app 不依赖其他 app，playground 保持独立。
- 标准示范归 playground：以 [system 模块](./playground/src/modules/system.tsx) 与[系统 CRUD](./playground/src/system/ResourcePage.tsx) 为准；产品显示名和存储身份留在 app。backend-mock 仅开发/测试，不能进入生产运行产物。检查命令见[工程指南](../docs/guide/engineering-deploy.md)。
