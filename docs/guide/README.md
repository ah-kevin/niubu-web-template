# 开发指南

本仓库是独立的 Web 模板，包含管理后台 starter、示范 app Playground 和开发用假后端 backend-mock。`@niubu/*` 只是包名，产品名称、标识与存储空间由 app 配置。安装与启动见[根 README](../../README.md)。

先读这两篇，所有改动都适用：

| 文档                        | 内容                                                       |
| --------------------------- | ---------------------------------------------------------- |
| [开发标准](./standards.md)  | 技术栈、目录与依赖、命名、样式、多语言、代码、测试、提交   |
| [工作方式](./workflow.md)   | 检查怎么跑、Git 流程、模板仓库与业务仓库的同步、记录放哪   |

做具体功能时按主题查：

| 主题                                          | 入口                                       |
| --------------------------------------------- | ------------------------------------------ |
| 目录职责、模板名与产品名、app 生命周期        | [结构与命名](./structure.md)               |
| 新增模块、稳定 pageId、静态 loader            | [模块登记](./modules.md)                   |
| 两层表单、查询表格、系统 CRUD                 | [表单、查询与 CRUD](./forms-query-crud.md) |
| 权限与菜单、请求、上传下载、运行配置、锁屏    | [鉴权与请求](./auth-request.md)            |
| 工具链、hooks、CI、构建产物与体积、Docker     | [工程与部署](./engineering-deploy.md)      |
| 已有组件与功能示例，以及与 Vben 的对照        | [Vben 能力对照与示例索引](./vben-examples-comparison.md) |

源码是接口的最终依据，优先从 [system 模块](../../apps/playground/src/modules/system.tsx)、[系统 CRUD](../../apps/playground/src/system/ResourcePage.tsx) 和[启动入口](../../apps/playground/src/main.tsx) 查起。mock 的启动、接入和替换数据见 [backend-mock README](../../apps/backend-mock/README.md)。

新产品生成、mock profile、scope 与安装验证步骤见 [新产品起步](./product-start.md)。
