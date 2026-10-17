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
- 首屏体积按真实首屏静态依赖去重后逐文件 gzip（level 6）计算，预算 `307_200` 字节（300 KiB）。当前策略是只报告不拦截：超出时检查仍通过，但报告里 `withinBudget` 为 `false`，必须如实说明，不能写成达标。

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
