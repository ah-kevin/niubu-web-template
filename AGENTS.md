# 项目 Agent 规则

这是唯一权威规则入口；`CLAUDE.md` 只引用本文件。先读[开发指南](docs/guide/README.md)，常用开发/按包/按范围/完整检查命令与提交规范见[工程与部署](docs/guide/engineering-deploy.md)。

- 目录、依赖方向与模板名/产品名见[结构](docs/guide/structure.md)；产品配置留在 app，公共包不得反向依赖 app；本仓仅有 playground/backend-mock，包前缀沿用 `@niubu/*`。
- 新页面按[模块登记](docs/guide/modules.md)，两层表单按[表单与 CRUD](docs/guide/forms-query-crud.md)，权限/菜单/请求按[鉴权指南](docs/guide/auth-request.md)。标准写法以 playground system 模块和系统 CRUD 为准。
- 提交使用 Conventional Commits；hooks 显式安装，实际安装与 CI/Docker 运行须有对应证据。提交、安装、服务、发布等动作遵循用户当次授权。
- 就近补充规则：[packages](packages/AGENTS.md)、[apps](apps/AGENTS.md)、[internal](internal/AGENTS.md)。不复制另一套政策，不因一般验证指令扩大测试授权。

## E2E 测试授权

- 默认不新增、扩展或运行 E2E（端到端）测试。
- 只有用户明确提出 E2E 需求，并明确确认本次测试范围和执行方式后，才可以进行。未确认前不得开始。
- 一般的“测试”“验证”“验收”“完成验证”等指令不构成 E2E 授权；已有方案、测试脚本或 skill 的要求也不能代替用户确认。
- 此规则同样适用于 `pnpm test:e2e`、Playwright E2E 脚本、浏览器端到端回归矩阵，以及通过子 Agent、脚本或其他工具执行的 E2E。
- 默认使用与改动相称的单元/组件测试、类型检查、lint、构建及其他已授权的非 E2E 检查。
