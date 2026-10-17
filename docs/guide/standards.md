# 开发标准

两个仓库共用的基础标准。以模板仓库为准，业务仓库逐字同步。具体写法见同目录的专题指南。

## 技术栈

- React + TypeScript，Vite 构建，pnpm monorepo，Turbo 编排任务。
- 基础控件用 `@niubu/shadcn-ui`（shadcn + Radix），样式用 Tailwind。
- 表单用 RHF + Zod，服务端数据用 TanStack Query，HTTP 请求只走 `@niubu/request`。
- 外部依赖版本统一登记在 `pnpm-workspace.yaml` 的 catalog，包里写 `catalog:`；内部包写 `workspace:*`。新增第三方依赖先经用户同意。

## 目录与依赖

- app 放 `apps/`，公共能力放 `packages/`，工具与配置放 `internal/`，根集成测试放 `tests/integration/`。
- 依赖只能从 app 指向公共包：公共包不能依赖 app，app 之间不能互相依赖，不能有循环依赖。
- 包之间只通过对方 `package.json` 声明的 exports 引用，不用相对路径进入别的包的源码。
- 产品名称、存储标识、启动初始化都放在 app。公共包不写产品专用内容，也不在模块顶层创建带产品身份的单例。

## 命名

- React 组件文件用 `PascalCase.tsx`，文件名与主组件同名，例如 `ResourcePage.tsx` 导出 `ResourcePage`。
- hook 文件可以与 hook 同名，例如 `useSchemaForm.tsx`。
- 其他源码文件用 `kebab-case.ts`，例如 `query-context.ts`。
- 页面 id（pageId）用点分小写，例如 `playground.system.users`；发布后不随文案或 URL 修改。
- 翻译 key 是扁平字符串，用点分层级，例如 `system.users.title`。
- 公共包前缀是 `@niubu/*`，工具包前缀是 `@niubu-internal/*`。它们只是包名，不是产品显示名。
- 现有不符合的文件名不集中改，改到时再顺手调整。

## 样式

- 基础控件只用 shadcn 组件，不另写按钮、输入框、弹窗这类基础控件。
- 新写的页面和组件用 Tailwind 工具类。颜色、圆角、间距用设计变量（`packages/styles` 的 token），不写死色值。
- 只有 Tailwind 写不了的情况才写 CSS 文件，例如复杂选择器、动画、覆盖第三方组件。CSS 文件放在组件旁边，类名加组件前缀。
- 现有的自写 CSS 不集中重写，改到哪个组件就顺手迁到 Tailwind。

## 文案与多语言

- 用户看得到的文字都放进翻译文件，中英文 key 必须一一对应，`pnpm locale:check` 会检查。
- 公共文案在 `packages/locales`；app 文案放在 app 自己的 `src/locales`，不能覆盖公共的 `common`、`validation`、`shell`。
- 日期、金额、数量用 `@niubu/locales` 的格式化函数，不手写格式。

## 代码

- TypeScript 严格模式，不用 `any` 绕过类型。接口响应、本地存储、URL 参数这类外部数据，先用 Zod 或解码函数校验再使用。
- 代码注释用英文，只写为什么这样做，不复述代码；文档用中文。
- 格式交给 Prettier（单引号、行宽 120），规范交给 ESLint，不手动调整格式。

## 测试

- 默认写单元测试和组件测试（Vitest + Testing Library）。E2E 只有用户明确授权后才能新增或运行，见根规则。
- 测试文件放置：
  1. 只测一个源文件的测试，与源文件同名放在旁边：`foo.ts` 对应 `foo.test.ts`。
  2. 测多个文件组合起来的行为（页面、流程、回归场景），或需要共用测试数据的，放进被测内容最近公共目录下的 `tests/`。
  3. 需要组合多个包才能测的，放进根目录 `tests/integration/`。
  4. E2E 只放根目录 `tests/e2e*`。
- 现有放置不符合的测试不集中搬，改到时再顺手挪。
- 测试验证的是行为。不能为了通过而删断言、放宽超时或跳过测试。

## 提交

- 提交信息用 Conventional Commits，例如 `feat(forms): add a resource editor`、`fix(request): reject stale results`。type 和 scope 按实际改动选。
- 一次提交只做一件事。`packages/`、`internal/` 的改动和 app 示例分开提交，方便同步到业务仓库。
