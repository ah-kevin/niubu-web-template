# 项目 Agent 规则

这是 Agent 的唯一规则入口，`CLAUDE.md` 只引用本文件。

本仓库是 Web 模板仓库：React + shadcn + Tailwind 的 monorepo 基础，包含管理后台样板 `apps/starter`、示范 app `apps/playground` 和开发用假后端 `apps/backend-mock`。规范、`packages/`、`internal/` 以本仓库为准，业务仓库从这里同步。

## 必须遵守

1. 动手前先读[开发标准](docs/guide/standards.md)和[工作方式](docs/guide/workflow.md)。写页面、表单、权限、请求之前，读[开发指南](docs/guide/README.md)里对应的专题。
2. 公共包不依赖 app，不写产品专用内容；包之间只用对方声明的 exports。
3. 新增或修改公共能力时，在 Playground 补上示例。Playground 是业务仓库参照的标准写法。
4. 检查默认跑 `pnpm check` 和 `pnpm format:check`。`pnpm check` 靠缓存增量执行，不要删缓存冷跑。
5. 新增第三方依赖、安装、启动服务、推送、发布，都按用户当次授权执行。
6. 验证与交付记录不提交进本仓库，结论写回任务卡。
7. 自动化 E2E 默认不做；浏览器操作回归允许按任务需要执行，见下方规则。

各目录的补充规则：[apps](apps/AGENTS.md)、[packages](packages/AGENTS.md)、[internal](internal/AGENTS.md)。

## E2E 测试授权

- 允许通过已登录 Chrome、内置浏览器及其浏览器控制工具逐页操作、输入、截图，并执行浏览器端到端回归矩阵；这类浏览器操作检查无需另行申请 E2E 授权。
- 默认不新增、扩展或运行自动化 E2E（端到端）测试脚本，不使用 `pnpm test:e2e`、Playwright、Cypress 等测试框架或测试运行器执行 E2E。
- 自动化 E2E 只有用户明确提出需求，并确认本次测试范围和执行方式后才可以进行。一般的“测试”“验证”“验收”等指令、已有测试脚本或 skill 要求都不能代替确认。
- 上述自动化 E2E 限制同样适用于子 Agent、脚本和其他工具代跑；不得把测试脚本或测试运行器执行包装为浏览器操作检查。
- 单元/组件测试（Vitest + Testing Library）、类型检查、lint、构建和其他与改动相称的非 E2E 检查照常执行。
