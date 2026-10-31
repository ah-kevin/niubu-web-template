# 开发指南

本仓库是独立的 Web 模板，包含管理后台 starter、示范 app Playground 和开发用假后端 backend-mock。`@niubu/*` 只是包名，产品名称、标识与存储空间由 app 配置。安装与启动见[根 README](../../README.md)。

先读这两篇，所有改动都适用：

| 文档                       | 内容                                                     |
| -------------------------- | -------------------------------------------------------- |
| [开发标准](./standards.md) | 技术栈、目录与依赖、命名、样式、多语言、代码、测试、提交 |
| [工作方式](./workflow.md)  | 检查怎么跑、Git 流程、模板与业务仓库的关系、记录放哪 |

开始任务时先明确目标 app、需求与验收，再按下表查阅。首次初始化之后，新增页面和模块直接编写普通源码；初始化生成器不承担日常模块开发或已有产品升级。

| 要做的任务                                   | 查阅入口                                                 | 现有参考                                                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首次创建产品、选择 mock profile 或公开 scope | [新产品起步](./product-start.md)                         | `apps/starter` 生成到新产品的 `apps/web`                                                                                                                                                                               |
| 新增普通页面或模块                           | [模块登记与接入清单](./modules.md)                       | [Starter 首页](../../apps/starter/src/modules/home.tsx)、[registry](../../apps/starter/src/modules/demo.tsx)                                                                                                           |
| 查询列表、新建和编辑表单                     | [表单、查询与 CRUD 接入清单](./forms-query-crud.md)      | [系统列表](../../apps/starter/src/system/ResourcePage.tsx)、[编辑器](../../apps/starter/src/system/ResourceEditor.tsx)                                                                                                 |
| 逐模块改进列表、详情、表单与反馈             | [业务模块体验检查清单](./business-module-ux.md)          | [表格工具](../../apps/playground/src/examples/tables/TablesPage.tsx)、[表单与取消](../../apps/playground/src/examples/forms/FormsPage.tsx)、[读取反馈](../../apps/playground/src/examples/components/FeedbackPage.tsx) |
| 菜单、读写权限、请求与失效恢复               | [鉴权与请求](./auth-request.md)                          | [系统路由读权限](../../apps/starter/src/modules/system.tsx)、[请求与 lease](../../apps/starter/src/system/resource-runtime.ts)                                                                                         |
| 目录职责、产品标识和 app 生命周期            | [结构与命名](./structure.md)                             | [Starter 启动入口](../../apps/starter/src/main.tsx)                                                                                                                                                                    |
| 选择测试、验证样式、构建或部署               | [工程与部署](./engineering-deploy.md)                    | 该页的既有测试索引；交付门槛见[工作方式](./workflow.md)                                                                                                                                                                |
| 查已有组件用法和 Vben 视觉对照               | [Vben 能力对照与示例索引](./vben-examples-comparison.md) | Playground 中的现有示例                                                                                                                                                                                                |

主体区控件、浮层与反馈的当前样式和新增 API 见[主体区设计系统](./design-system.md)。

源码是接口的最终依据，包的可用入口以 `package.json` 的 exports 为准。Starter 展示产品装配，Playground 展示公共能力；参考源码时在目标 app 内按需适配，app 之间不互相导入。系统资源页面有自己的 DTO、权限和 API，不能当作任意业务的通用 CRUD 接口。

mock 的启动、接入和替换数据见 [backend-mock README](../../apps/backend-mock/README.md)。模板冻结 1.0 前，回流改动的核对方式见[工作方式](./workflow.md)；冻结后业务仓库不再接收模板更新。
