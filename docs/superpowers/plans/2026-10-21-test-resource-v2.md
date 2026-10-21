# 测试资源与交付规则简化v2实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先模板后业务落地本地2worker、日常相关检查及目录/缓存复用约定，保持CI完整回归。

**Architecture:** 现有createTestConfig按CI标记给本地2/CI50%；Turbo test任务声明CI环境输入。Root配置行为测试核实际消费者，指南维护检查分层；不增加工具或依赖。

**Tech Stack:** 现有Node、Vitest、Vite、Turbo和pnpm。

**Spec:** [已授权v2](</Users/bjke/Library/Mobile Documents/iCloud~md~obsidian/Documents/agent-workspaces/Notes/Plans/2026-10-20-NiuBu-Web测试优化简化方案-v2.md>)。用户2026-10-21明确授权完整实施、验证后本地提交合并和Task/Case写回；本会话直接执行，不逐项确认。

## Global Constraints

- 模板95a719b、业务b30f5c2干净基线；复用canonical checkout/依赖/缓存，codex/test-resource-v2功能分支，不建临时副本/安装/服务。
- 本地测试最多2worker，CI原50%策略；同仓重检查串行，现有包测试concurrency=1保持。
- 不改真实业务、291路由/67菜单、肉牛奶牛双线、disabled/单Web/静态与存储身份，不改CI工作流/include/锁或断言。
- 不新增自动选测命令、范围元数据、缓存共享/调度系统、依赖或自动化E2E，不push/release。
- 公共源码/必要Root合同和共享规范先模板验证后固定来源同步；turbo/产品指南定点适配，四严格规则最终一致。
- 证据留ignored .superpowers，结论回Task/Case；仓库只提交源码/指南与本执行计划。

## Review Focus

- CI缺失、空串、false/0不能误用CI半核；仅true/1使用原50%。
- Root、真实app/package配置不能覆盖本地上限；保留各自include/alias/setup与隔离。
- Turbo严格环境传递及缓存必须区分本地/CI策略，不能只在配置中读取却未声明输入。
- 指南日常小改不能仍要求整Web/Root全集；公共基础完整回归和CI仍保留，相关测试选择由Agent说明。
- 固定来源/非目标hash、四共享规则及两仓产品差异不得被覆盖；复用验证需输入一致。

---

### Task 1: 模板配置、合同与规则

**Files:** 修改internal/test-config/src/index.ts、turbo.json、AGENTS.md、internal/AGENTS.md、docs/guide/{workflow,engineering-deploy,modules}.md；新增tests/integration/test-worker-policy.test.ts；本计划。

**Interfaces:**
- Consumes: createTestConfig现有root/environment/include/setupFiles；实际各项目vitest.config.ts；CI环境和Turbo dry-run。
- Produces: 原API不变，本地maxWorkers=2，CI=true/1为50%；Turbo test.env包含CI；下一Task逐字复制共享成果。

- [x] **Step 1:** 保存两仓所有tracked hash/mode及允许路径；记录改前LOCAL/CI dry-run；Root新增真实配置合同。表驱动CI未设/空/false/0→2，true/1→50%，node/jsdom与owner清理原配置保持。用Vite加载Root和实际workspace配置核消费，不写文档文本测试。
- [x] **Step 2:** 运行pnpm test:integration tests/integration/test-worker-policy.test.ts --maxWorkers=2，确认本地上限断言真实RED。Expected: 功能缺失导致失败，不是导入/类型错误。
- [x] **Step 3:** createTestConfig在调用时判断process.env.CI（true/1），本地2/CI50%；test.env新增CI。复跑同一合同GREEN；dry-run核相同输入稳定、本地/CI测试哈希不同，CI已传递。
- [x] **Step 4:** 更新规则与指南：日常/小改相关测试+类型/lint/格式，基础/CI完整；缓存/worktree、2worker/多Agent串行和证据边界。内部规则与模块指南消除旧半核/完整交付歧义；不修改CI脚本。
- [x] **Step 5:** 完整pnpm check、pnpm format:check串行，各exit0；核链接、diff与保护基线。公共运行配置/合同一提交，指南与计划另提交；记录固定模板来源。

### Task 2: 业务同步、验证和本地交付

**Files:** 业务修改与Task1对应共享配置/Root测试、两份严格共享规则；AGENTS、engineering-deploy、modules及README定点适配；turbo只增加test.env CI。

**Interfaces:**
- Consumes: Task1已完整验证固定提交的index.ts/Root合同/workflow/internal规则；业务现有单Web配置/指南。
- Produces: 两仓公共一致、业务291/67/disabled保持，局部验证和两仓基础回归/本地master交付的真实记录。

- [x] **Step 1:** 模板通过并提交后才建业务分支，同步index.ts、Root合同、workflow、internal规则为固定blob；turbo与业务指南定点修改，不复制模板多app/生成器断言。
- [x] **Step 2:** 运行业务同名Root合同、选择已有route-scope/user-shell相关测试展示局部交付，并做业务LOCAL/CI dry-run；随后业务完整pnpm check/format，均exit0。不修改业务功能来演示。
- [x] **Step 3:** 公共改动与指南分开本地提交；核公共字节/模式、四共享规则、所有非目标hash和无工具/依赖/CI变化；最终一次fresh-context只读整分支审阅，处理实质问题。
- [x] **Step 4:** 已授权两仓快进合并本地master，复用相同源树已通过检查，不机械重跑；安全删除本轮分支和自有scratch。写Task/Case实际回执，无push/release/自动化E2E。
