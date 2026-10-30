# 工作方式

两个仓库共用的工作约定。以模板仓库为准，业务仓库逐字同步。

## 检查怎么跑

日常开发和普通业务小改交付按影响验证；CI、公共运行基础、工程工具或全局依赖/配置变更执行完整回归。

| 场景 | 检查范围 |
| --- | --- |
| 开发中定位 | 相关测试文件或场景，必要时扩大到所属域和实际消费者 |
| 普通业务小改交付 | 相关测试、受影响 app/package 类型检查、修改文件的 lint/格式；按实际影响补 locale、workspace、路由/权限/来源合同 |
| 纯文档/注释 | 核内容、链接、命令和适用格式，不默认 Vitest、build或完整check |
| 可见 UI、样式或资源接线 | 相关组件/实际 CSS 消费检查与受影响页面浏览器操作；样式入口/扫描、lazy资源或首屏依赖变化时追加受影响 app build/budget |
| 公共基础变更、CI | 完整 `pnpm check` 与 `pnpm format:check`，保留所有测试和断言，利用现有缓存 |

小改按实际影响判断，不按行数。共享协议、跨域权限/scope/runtime等基础变化需要说明影响并扩大相应回归；不能仅因改了 app 就默认整 app，也不能把判断不清的影响当作局部通过。

执行局部测试的现有命令：

```sh
pnpm --filter @niubu/common-ui exec vitest run src/form/schema-form.test.tsx --maxWorkers=2
pnpm --filter @niubu/common-ui typecheck
pnpm test:integration tests/integration/session-login-cancellation.test.ts --maxWorkers=2
```

文件只是定位示例，按真实改动选择。Root 集成用具体文件过滤；不要先运行根 `pnpm test` 的全部 Root 测试，再误以为追加参数已经缩小范围。格式/lint使用原规则，仅检查有关文件；不以编译孤立文件替代 app/package 的类型检查。

完整入口保持原语义：

```sh
pnpm check          # 边界、locale、类型、lint、测试、构建与首屏体积；失败即停
pnpm format:check   # 完整格式检查
```

### 选择范围与复用结果

- 交付前核完整任务变更：起始基线到 HEAD 的全部提交，加暂存、未暂存与 Git 未忽略的未跟踪文件；删除/rename 两端都纳入，不只看最后一次提交。
- Agent按现有源码、依赖与测试职责选择相关用例，在任务记录简述影响、选测依据、实际命令/退出码和局部/全量范围；不新增自动选测工具或范围登记系统。
- 需要测试的运行变化却找不到测试时，补必要验证；零用例不等于通过。纯文档说明测试不适用，不写复述文案的测试。
- 同一源码/配置/工具输入与范围已有通过记录时可复用；不为提交、合并、推送机械重复完整回归。冲突解决、新输入、失败或具体疑点出现后重跑受影响检查。推送成功不代表CI通过。
- 验收已有交付先核命令、退出码、日志和输入，再补实际缺口，不重复同一份完整检查。验证记录不提交进仓库，结论写回任务卡。

### 工作目录、缓存与本地资源

- 连续工作复用已有checkout、依赖和缓存，不为小任务复制临时项目或反复安装。同一checkout不能交给独立writer并行修改；需要隔离时使用正规关联Git worktree。
- 用 `git worktree list --porcelain` 核关联；Turbo可复用主仓本地缓存，显式cacheDir会改变默认机制。必要时用已有Turbo的 `--dry=json` 核实际HIT/MISS，不为核缓存真实跑全量；连续工作不反复预演。
- HIT表示任务复用；合法源码/依赖/配置或命令输入变化导致MISS时正常验证。Root集成等非Turbo步骤仍执行，不把回放日志称为新跑测试。不删/挪缓存冷跑或改输入伪造命中。
- worktree不自动共享node_modules；不强行复制/软链其他checkout依赖。依赖准备遵循当次授权。缓存产物不会改写内部绝对路径，需要时核真实消费，不强制套用旧产物。
- 本地测试默认最多2个worker（`internal/test-config`），可降到1，不得通过CLI或伪装CI提高上限。真实CI标记 `CI=true` 或 `CI=1` 保留原50%策略，其他值采用本地策略。
- 测试包保持串行。同仓多Agent由主写者协调，只运行一组本地重测试/check/build链，其他任务等待或复用已核结果，不各自启动2worker叠加消耗。此为执行规则及测试默认配置，不是全机进程限额或调度服务。
- 限并发主要降低CPU/内存峰值，可能增加耗时；不为提速关闭隔离、放宽断言/超时或改变半核CI策略。自动化E2E仍不在默认检查里；Chrome/IAB浏览器操作范围见根规则。

## Git

- 主干是 `master`。在功能分支上开发（`feat/...`、`fix/...`、`chore/...`），自测通过后合并到 `master`，再删除已合并的本地分支。
- 推送、删除远端分支、改写已推送的历史，只能由用户来做，或经用户当次同意。
- 提交前的 hooks 需要手动安装：`pnpm hooks:install`。

## 模板仓库与业务仓库

- 模板仓库是公共基础的来源。规范、`packages/`、`internal/` 的改动先在模板仓库做，并在 Playground 补上示例。
- 用户确认后，再把同一份改动同步到业务仓库。两边只要求起步一致，之后各自演进；不发布 npm，也不做自动同步。
- 业务仓库在仓库根目录运行 `pnpm template:check --template <模板路径>`（或设置 `NIUBU_TEMPLATE_PATH`），逐文件对比 `packages/`、`internal/`、`scripts/`、`apps/playground/` 与模板；有意的差异登记在业务仓库的 `template-divergence.json`（路径与原因），未登记的差异或已失效的登记都会失败。
- 两边逐字一致的文件：`docs/guide/standards.md`、`docs/guide/workflow.md`、`packages/AGENTS.md`、`internal/AGENTS.md`。改其中任何一份，两边一起改。
- backend-mock 两边都有，是独立的开发用假后端：用 `pnpm dev:backend-mock` 单独启动，需要它的 app 通过 `/api` 开发代理接入，生产构建不包含它。接入和替换数据的方法见 `apps/backend-mock/README.md`。

## 记录放哪

- 验证和交付记录不提交进仓库，`docs/verification/` 已加入 `.gitignore`。过程证据放在已忽略的 `.superpowers/`，结论写回任务卡。
- 执行计划放在 `docs/superpowers/plans/`。
