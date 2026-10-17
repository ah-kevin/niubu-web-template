# 开发指南

本仓库是独立 Web 模板，仅包含 Template Playground 前端与开发用 backend-mock。`@niubu/*` 是模板包名，产品名称、标识与存储空间由 app 配置。安装与快速启动见[根 README](../../README.md)。

| 主题                                              | 入口                                       |
| ------------------------------------------------- | ------------------------------------------ |
| 目录结构、依赖方向、模板名与产品名                | [结构与命名](./structure.md)               |
| 新增业务模块、稳定 pageId、静态 loaders           | [模块登记](./modules.md)                   |
| 两层表单、查询与系统 CRUD、dirty 与异步租约       | [表单、查询与 CRUD](./forms-query-crud.md) |
| 权限与菜单、身份与 scope                          | [鉴权与请求](./auth-request.md)            |
| 唯一业务请求入口、上传下载、运行配置、锁屏与更新  | [鉴权与请求](./auth-request.md)            |
| 开发命令、包与范围检查、完整检查                  | [工程与部署](./engineering-deploy.md)      |
| Conventional Commits、显式 hooks 安装、CI、Docker | [工程与部署](./engineering-deploy.md)      |

Agent 从[根规则](../../AGENTS.md)进入；[packages](../../packages/AGENTS.md)、[apps](../../apps/AGENTS.md)、[internal](../../internal/AGENTS.md) 只补充区域边界，CLAUDE 只引用根规则。E2E 授权原文仅保留在根规则。

源码是接口依据，优先从 [playground 模块](../../apps/playground/src/modules/system.tsx)、[系统 CRUD](../../apps/playground/src/system/ResourcePage.tsx)、[显式启动入口](../../apps/playground/src/main.tsx) 查起。公开演示账户说明见 [backend-mock README](../../apps/backend-mock/README.md)，这里不复制登录信息。

启动、hooks、CI 与 Docker 的使用方法见[工程与部署](./engineering-deploy.md)。mock 独立启动、接入和扩展方式见 [backend-mock README](../../apps/backend-mock/README.md)。
