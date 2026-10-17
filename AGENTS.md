# 项目 Agent 规则

这是 Agent 的唯一规则入口，`CLAUDE.md` 只引用本文件。

本仓库是 Web 模板仓库：React + shadcn + Tailwind 的 monorepo 基础，包含示范 app `apps/playground` 和开发用假后端 `apps/backend-mock`。规范、`packages/`、`internal/` 以本仓库为准，业务仓库从这里同步。

## 必须遵守

1. 动手前先读[开发标准](docs/guide/standards.md)和[工作方式](docs/guide/workflow.md)。写页面、表单、权限、请求之前，读[开发指南](docs/guide/README.md)里对应的专题。
2. 公共包不依赖 app，不写产品专用内容；包之间只用对方声明的 exports。
3. 新增或修改公共能力时，在 Playground 补上示例。Playground 是业务仓库参照的标准写法。
4. 检查默认跑 `pnpm check` 和 `pnpm format:check`。`pnpm check` 靠缓存增量执行，不要删缓存冷跑。
5. 新增第三方依赖、安装、启动服务、推送、发布，都按用户当次授权执行。
6. 验证与交付记录不提交进本仓库，结论写回任务卡。
7. E2E 默认不做，见下方授权规则。

各目录的补充规则：[apps](apps/AGENTS.md)、[packages](packages/AGENTS.md)、[internal](internal/AGENTS.md)。

## E2E 测试授权

- 默认不新增、扩展或运行 E2E（端到端）测试。
- 只有用户明确提出 E2E 需求，并明确确认本次测试范围和执行方式后，才可以进行。未确认前不得开始。
- 一般的“测试”“验证”“验收”“完成验证”等指令不构成 E2E 授权；已有方案、测试脚本或 skill 的要求也不能代替用户确认。
- 此规则同样适用于 `pnpm test:e2e`、Playwright E2E 脚本、浏览器端到端回归矩阵，以及通过子 Agent、脚本或其他工具执行的 E2E。
- 默认使用与改动相称的单元/组件测试、类型检查、lint、构建及其他已授权的非 E2E 检查。
