# 工作方式

两个仓库共用的工作约定。以模板仓库为准，业务仓库逐字同步。

## 检查怎么跑

默认用这两条，提交或合并前都可以跑：

```sh
pnpm check          # 边界、翻译 key、类型、lint、测试、构建、首屏体积，任何一步失败就停
pnpm format:check   # 格式
```

- `pnpm check` 本身是增量的：Turbo 缓存各包的结果，没改动的包直接回放，只重跑改动的包和依赖它的包。代码没变时整条链只要几秒。
- 缓存按 `turbo.json` 声明的全局输入和各任务输入失效。根依赖清单、锁文件和共享配置会影响全仓；`internal/scripts/src` 通过应用构建任务的输入追踪，ESLint 配置包源码通过 lint 任务的输入追踪，不会因任意脚本改动就清空全部缓存。
- 不要为了"冷跑"去删或挪走缓存，除非确实怀疑缓存有问题。

开发中只想快速看一个包或一个文件时：

```sh
pnpm --filter @niubu/common-ui test             # 单个包；typecheck、lint 同理
pnpm --filter '@niubu/common-ui...' test        # 连同它依赖的包
pnpm --filter @niubu/common-ui exec vitest run src/form/schema-form.test.tsx   # 单个测试文件
```

- 验收别人的交付时，如果对方已经给出完整检查的命令、退出码和日志，就只核对这些证据，再跑改动相关的测试，不再整套重跑。
- 测试进程数默认是 CPU 核数的一半（见 `internal/test-config`），机器负载高时测试不容易超时误报。不要为了快改回全核。
- E2E 不在任何默认检查里。只有用户明确授权后才能新增或运行，见根规则。

## Git

- 主干是 `master`。在功能分支上开发（`feat/...`、`fix/...`、`chore/...`），自测通过后合并到 `master`，再删除已合并的本地分支。
- 推送、删除远端分支、改写已推送的历史，只能由用户来做，或经用户当次同意。
- 提交前的 hooks 需要手动安装：`pnpm hooks:install`。

## 模板仓库与业务仓库

- 模板仓库是公共基础的来源。规范、`packages/`、`internal/` 的改动先在模板仓库做，并在 Playground 补上示例。
- 用户确认后，再把同一份改动同步到业务仓库。两边只要求起步一致，之后各自演进；不发布 npm，也不做自动同步。
- 两边逐字一致的文件：`docs/guide/standards.md`、`docs/guide/workflow.md`、`packages/AGENTS.md`、`internal/AGENTS.md`。改其中任何一份，两边一起改。
- backend-mock 两边都有，是独立的开发用假后端：用 `pnpm dev:backend-mock` 单独启动，需要它的 app 通过 `/api` 开发代理接入，生产构建不包含它。接入和替换数据的方法见 `apps/backend-mock/README.md`。

## 记录放哪

- 验证和交付记录不提交进仓库，`docs/verification/` 已加入 `.gitignore`。过程证据放在已忽略的 `.superpowers/`，结论写回任务卡。
- 执行计划放在 `docs/superpowers/plans/`。
