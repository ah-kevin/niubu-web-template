# 工程与部署

日常检查怎么跑、Git 流程见[工作方式](./workflow.md)。本页说明工具链、启动、hooks、CI、构建产物和部署。

## 工具链与依赖

- 根 [package.json](../../package.json) 要求 Node `>=24.16.0`、pnpm `11.25.0`；CI 固定使用 Node `24.16.0`。
- 外部依赖版本统一登记在 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) 的 catalog，包里写 `catalog:`；内部包写 `workspace:*`；全仓库只有一个锁文件。
- 新增依赖前先核对包的发布时间、许可证、engines/peers、传递依赖和安装脚本，并经用户同意。安装失败时不用 force、不降低包龄要求、不放宽 trust 策略来绕过。

在仓库根目录独立安装，不复用其他仓库的 node_modules：

```sh
SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile --ignore-scripts
```

## 启动

```sh
pnpm dev                      # 启动前端；只有一个前端时自动选中
pnpm dev --app @niubu/playground
pnpm preview --app @niubu/playground --port 5180   # 服务已有构建产物
```

mock 是独立服务，在两个终端分别启动：

```sh
pnpm dev:backend-mock         # 默认 127.0.0.1:5320
pnpm dev:playground           # 默认 127.0.0.1:5174，/api 代理到 mock
```

接入方式见 [playground README](../../apps/playground/README.md) 和 [backend-mock README](../../apps/backend-mock/README.md)。新增多个前端后，`dev`、`preview` 要用 `--app` 指定；名称有歧义或不存在时直接失败。`preview` 不启动 mock，需要可访问的 API 和公开运行配置。

## 完整检查包含什么

`pnpm check`（[scripts/check.ts](../../scripts/check.ts)）按顺序执行，任何一步失败就停：

1. `workspace:check`：依赖关系、源码 exports、测试归属、产品词边界。
2. `locale:check`：各 namespace 的中英文 key 和插值参数一致，app 不能覆盖公共 namespace。
3. `typecheck`、`lint`、`test`、`build`：根目录加上 Turbo 编排的全部包。`test` 包含根集成测试。
4. `budget:check`：首屏体积报告。

`pnpm format:check` 单独运行。E2E 不在这条链里。

## 开发时选择检查

日常与普通业务小改交付按[工作方式](./workflow.md)选择相关测试、受影响app/package类型和修改文件的lint/格式；完整回归留CI或公共基础变更。复用目录/缓存，本地测试最多2worker、同仓重检查串行，不为每次提交/合并重复同输入验证。纯文档核内容/链接/命令与格式，不新增复述实现的测试。

| 改动 | 检查与现有参考 |
| --- | --- |
| 规则、文档与链接 | 对照源码、公开 exports 和实际 package scripts，检查本地链接与格式；不增加运行时测试 |
| 表单、查询、列表与编辑 | 受影响包/app 的 Vitest + Testing Library 行为；[Starter CRUD 测试](../../apps/starter/src/system/crud.test.tsx)示范受控 API、实际 providers、QueryClient 与 owner 的装配和清理，不证明后端持久化 |
| 登录恢复、菜单或 app 生命周期 | [Starter 启动集成](../../tests/integration/starter-startup.test.tsx)通过 [mock 响应桥](../../tests/integration/mock-response.ts)连接真实 `createMockBackend` 与 app runtime，不启动外部服务；根集成测试可组合 app 与 mock，页面单测不跨 app 引用私有 fixture |
| 样式入口、扫描或公共布局 | [Starter 编译样式回归](../../apps/starter/src/styles/shell-styles.test.tsx)使用 [app 本地编译辅助](../../apps/starter/src/tests/compiled-styles.ts)检查真实 CSS；复用时适配目标 app 的入口，不把 jsdom 当作浏览器几何验收 |
| 模块、语言或包依赖 | 按需跑 `pnpm workspace:check`、`pnpm locale:check`，再做受影响 app/Root 行为检查 |
| 可见 UI 与交互 | 通过 Chrome 或内置浏览器按影响范围操作菜单/直达、表格/表单/弹层、主题/双语/窄屏；核对位置稳定、取消和焦点恢复 |

测试 context 沿用现有 app provider 和显式 owner，每个测试隔离 QueryClient、认证、语言与存储，结束卸载并释放自有资源、恢复修改过的全局。先在所属测试中按需要适配现有装配，不跨 app 导入测试 helper，也不预先新建公共测试运行时。

例如在模板根目录定位系统页面或启动回归：

```sh
pnpm --filter @niubu/starter exec vitest run src/system/crud.test.tsx
pnpm --filter @niubu/starter exec vitest run src/styles/shell-styles.test.tsx
pnpm test:integration tests/integration/starter-startup.test.tsx
```

生成产品将 app 过滤器换为实际 `<公开scope>/web`；源码与配置路径也按目标项目核对。浏览器操作回归允许，默认不新增、扩展或运行自动化 E2E 脚本或测试运行器；授权边界见[根 Agent 规则](../../AGENTS.md)。以上测试使用既有 Vitest，不启动 Playwright/Cypress。

## HTTP 运行检查

`pnpm verify:playground`（[playground-runtime.ts](../../internal/scripts/src/playground-runtime.ts)）会临时启动 Playground（`127.0.0.1:5174`）和 mock（`127.0.0.1:5320`），检查首页 HTML 以及经代理的 `/api/health`、`/api/demo/echo`，然后关闭这两个服务。它不在默认检查里，需要时手动运行；运行前先关掉自己开着的开发服务，端口被占用时直接失败，不会关闭别人的服务。它不做浏览器渲染和登录，不是 E2E。

## 提交与 hooks

- 提交信息用 Conventional Commits，commitlint 使用 conventional 配置，不另设 scope 白名单。破坏性变更用 `!` 或 `BREAKING CHANGE` footer。
- hooks 用 `pnpm hooks:install` 手动安装（simple-git-hooks 管理 pre-commit 和 commit-msg）。安装依赖和 CI 时跳过 hooks 安装；安装前会检查是否与已有 hooks 配置冲突，不覆盖用户已有配置。
- pre-commit 只检查已暂存文件的格式和 lint。格式有变化时返回失败，让你复核后手动暂存，不会自动 `git add` 或 stash。commit-msg 用本地 commitlint 检查提交信息。

## CI

[CI 工作流](../../.github/workflows/ci.yml) 固定官方 action 的 SHA、Node `24.16.0`、pnpm `11.25.0`，用 frozen 安装和只读权限，执行 `pnpm format:check` 和 `pnpm check`。缓存按 OS、Node、pnpm 和锁文件区分，不缓存凭据；不运行 E2E、部署或 Docker。本地检查通过不等于线上 CI 通过，线上结果以实际运行记录为准。

## 构建产物与体积

- app 构建走 [build-app](../../internal/scripts/src/build-app.ts)，体积检查走 [budget](../../internal/scripts/src/budget.ts)。在包目录里运行时自动选该 app；在根目录有多个 app 时要显式指定。
- 构建会写出 `build-inputs.json`（源码与工具链的输入哈希、构建上下文）和 `first-screen-roots.json`（首屏真实入口），产物清单带不可变哈希。旧产物、缓存或手工改过的记录都不能冒充当前构建。
- 唯一允许部署后修改的文件是运行配置 `_app.config.js`，只能改合法的 `apiURL`，其他 HTML/JS/CSS 等文件变化一律拒绝。格式见[鉴权与请求](./auth-request.md)。
- 首屏体积按真实首屏静态依赖去重后逐文件 gzip（level 6）计算，参考预算 `512_000` 字节（500 KiB）。策略是只报告不拦截：超出时检查仍通过，但报告里 `withinBudget` 为 `false`，必须如实说明，不能写成达标。提高参考值不代表实际减载或提速；保留真实构建与历史报告，不为压线改动交互或过度拆包。

## Docker 与 nginx

根目录[多阶段 Dockerfile](../../Dockerfile) 的 `APP_NAME` 默认 `@niubu/playground`，可指定其他前端；backend-mock 不进最终镜像。构建和运行镜像前确认用户授权和端口：

```sh
docker build --build-arg APP_NAME=@niubu/playground -t template-playground:local .
docker run --rm --name template-playground -p 8080:80 -e APP_API_URL=https://api.example.test template-playground:local
```

- `APP_API_URL` 是公开的 API 地址，不传就沿用构建时的值。容器启动时用同一套校验和序列化逻辑重写运行配置文件，值非法则不启动 nginx。
- 最终镜像只包含静态前端、nginx 和生成配置所需的运行时，不含源码、node_modules 或后端。
- nginx：页面路由回退到 index；`/api`、`/api/` 和缺失的静态资源返回 404，带扩展名的缺失文件不回退到 HTML。HTML、index 和运行配置不缓存，只有带指纹的资源长期缓存。index 的 HEAD 和 GET 返回一致的 ETag/Last-Modified，供更新检测使用。
- 镜像能否正常运行要实际 build 和 run 才能确认，静态检查代替不了。
