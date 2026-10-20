# Agent 开发规范整理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅整理模板 Agent 规范与既有指南，明确首次初始化边界、两份模块接入清单和现有测试用法。

**Architecture:** 根 AGENTS 保持唯一规则入口，开发指南按任务导航；页面与列表编辑清单落在现有专题，引用现有源码及测试，不新建运行能力。

**Tech Stack:** Markdown，现有 pnpm 检查与源码走读。

**Spec:** [简化 v2](</Users/bjke/Library/Mobile Documents/iCloud~md~obsidian/Documents/agent-workspaces/Notes/Plans/2026-10-20-NiuBu-Web-4-3A-开发规范与初始化边界方案-v2.md>)。

## Global Constraints

- 业务仓不动，不推送、不发布，不跑自动化 E2E。
- 仅修改 AGENTS.md、已有开发指南与本执行计划；不改源码、UI、依赖、首次初始化参数。
- standards.md、workflow.md、packages/AGENTS.md、internal/AGENTS.md 保持逐字不变。
- 不新增开发期模块生成器、教学页面、mock 端点、测试 helper 或测试平台。
- 复用当前目录的依赖与缓存，在 codex/agent-guide-v2 分支完成本地文档交付。

## Review Focus

- 生成产品的 app 路径与可选公开 scope 不同，文档不能把 Starter 的路径或包名当作唯一接法。
- 普通首页并不示范动作 code，读写权限应链接真实系统模块并区分菜单与直达。
- 系统 ResourcePage/Editor 有 app 专属语义，不能当作任意业务的通用 CRUD API。
- Tailwind 扫描与专用 CSS 导入是两件事，新目录不能依赖测试文件提供样式类。
- 组件受控端口、真实 mock 启动与真实 CSS 测试证明不同边界，命令不能暗中运行自动化 E2E。

---

### Task 1: 整理入口、接入清单和验证说明

**Files:**

- Modify: AGENTS.md
- Modify: docs/guide/README.md
- Modify: docs/guide/product-start.md
- Modify: docs/guide/modules.md
- Modify: docs/guide/forms-query-crud.md
- Modify: docs/guide/engineering-deploy.md

**Interfaces:**

- Consumes: 现有 DomainModule、app registry/owner、系统页面、请求/表单公开 exports、app/Root/CSS 测试和实际 package scripts。
- Produces: 在现有指南内可逐项查阅的开发说明，不新增代码接口或第二份规则源。

- [x] **Step 1:** 对照现有指南与源码，确认文件、exports、样例、命令及共享规则基线。纯文档改动不新增复述实现的测试。
- [x] **Step 2:** 根入口与开发索引说明首次初始化、日常开发、模板升级的边界；product-start 链接生成后的开发步骤。
- [x] **Step 3:** 在 modules 与 forms-query-crud 补普通页面/列表编辑接入清单，注明 app/生成产品适配、权限、locale、样式、owner、dirty/焦点/迟到保护。
- [x] **Step 4:** 在 engineering-deploy 补现有测试索引与按改动选检查的说明；核对脚本、链接和 Review Focus 五项。
- [x] **Step 5:** 检查全部改动文档的相对链接（仓库内文件存在；Spec 外部 vault 链接另核）、引用符号和命令，运行 `git diff --check`、`pnpm check`、`pnpm format:check`。Expected: 链接有效、范围仅文档、全部 exit 0；四份共享规则与业务仓基线不变。
- [ ] **Step 6:** 本地提交，最终只读审阅后按仓库流程合并 master；将真实命令、结果和本地提交写回 Task/Case。Expected: 文档已本地交付，业务仓不变，无推送发布。
