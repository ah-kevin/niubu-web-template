# 工程与部署

## 工具链与依赖

根 [package.json](../../package.json) 要求 Node `>=24.16.0`、pnpm `11.25.0`。Node 是最低要求，CI 基线单独固定。外部依赖版本统一放 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) catalog，包中使用 `catalog:`；内部包用 `workspace:*`，全仓单锁文件。新增依赖先核包龄、许可、engines/peers、传递依赖和生命周期脚本，沿用当前 trust 策略；不通过 force、降低包龄或放宽 trust 绕过安装失败。

在本仓根目录独立安装，不复用其他仓库的 node_modules 或软链接：

```sh
SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile --ignore-scripts
```

下面的命令用于已授权的本地环境；命令示例不表示已经执行或通过。

## 开发与检查命令

从仓库根目录执行：

```sh
pnpm dev
pnpm dev --app @niubu/playground
pnpm --filter @niubu/playground build
pnpm --filter @niubu/playground budget:check
```

`dev:playground` 的开发插件会自动启动并管理 mock；如果要独立管理后端，改为分别在两个终端执行以下命令，避免同时占用 mock 端口：

```sh
pnpm dev:backend-mock
VITE_BACKEND_MOCK=0 pnpm dev:playground
```

接入说明见 [playground README](../../apps/playground/README.md) 与 [backend-mock README](../../apps/backend-mock/README.md)。生产构建不能包含 mock 运行代码。根 `dev/preview` 从实际前端 workspace 发现应用：当前唯一前端是 `@niubu/playground`，自动选择它；新增多个前端后应显式指定 `--app`，有歧义或显式应用不存在时失败。可执行 `pnpm dev --app @niubu/playground` 或 `pnpm preview --app @niubu/playground --port 5180`，参数以 argv 传递，不经过 shell 拼接。`preview` 只服务已有构建产物，不启动开发 mock；需要可访问的 API 后端与公开运行配置。

按包与按范围跑受影响的非 E2E 检查：

```sh
pnpm --filter @niubu/common-ui typecheck
pnpm --filter @niubu/common-ui lint
pnpm --filter @niubu/common-ui exec vitest run src/form/schema-form.test.tsx
pnpm --filter @niubu/playground test
pnpm --filter '@niubu/playground...' typecheck
pnpm --filter '@niubu/playground...' lint
pnpm --filter '@niubu/playground...' test
pnpm --filter @niubu-internal/scripts test
```

`...` 包含该包及其 workspace 依赖；focused test 不能代替 Root/全仓验收。完整检查使用：

```sh
pnpm workspace:check
pnpm locale:check
pnpm format:check
pnpm check
```

`workspace:check` 检查图、source exports、测试归属与 boundary；`locale:check` 校验 namespace、双语言 key/插值；逐实际前端 app 独立检查，公共 namespace 不允许被 app 覆盖。`check` 经 [scripts/check.ts](../../scripts/check.ts) 先做 workspace/boundary，再串行 locale → typecheck → lint → test → build → budget，非零立即失败。`test` 包含 `test:integration` 的 Root 测试与 Turbo 全包测试。`format:check` 单独运行；不把 E2E 加入上述链。Root 的 14 个既有 integration 测试文件全部保留，新增通用测试也归入同一编排；不删 Root 测试、不降低断言或跳过完整检查。

受限验证中，pnpm 可能隐式安装时使用已有本地 CLI，并由获授权的负责人处理依赖。例：只检查本文档可执行 `node node_modules/prettier/bin/prettier.cjs --check docs/guide/*.md AGENTS.md CLAUDE.md packages/AGENTS.md apps/AGENTS.md internal/AGENTS.md`。缺模块是环境失败，不能记为功能 RED，也不能据此宣称验证完成。

## 显式 HTTP 运行检查

根 [verify:playground script](../../package.json) 调用 [playground-runtime.ts](../../internal/scripts/src/playground-runtime.ts)。它不加入默认 check/test/CI；需要运行证明时，从根目录显式执行：

```sh
VITE_BACKEND_MOCK=1 pnpm verify:playground
```

该入口创建自己的 Vite server，加载实际 playground 配置，并由开发插件管理自己的 Nitro mock。前端绑定 `127.0.0.1:5174`，mock 绑定 `127.0.0.1:5320`；端口冲突失败，不复用或关闭既有外部服务。仅检查 `/` 的 HTTP 200 与 HTML 入口、经同一 Vite 代理的 `/api/health` 和 `/api/demo/echo`：响应须为 HTTP 200、数字 code 0、字符串 message，health 状态为 ok，echo 值及重复 query 与请求一致。它不执行浏览器渲染、登录或业务操作，不是浏览器 E2E。

启动及所有 HTTP 操作共享同一个 30 秒截止时间，响应体读取也在该 deadline 内；不能为每个请求重新计时。finally 只清理本次创建的 owner；成功后也要等待 `owned server.close()` 完成，才能对外报告 `cleaned: true`。操作截止不表示可以略过清理等待；启动、请求、断言、超时或关闭失败均须失败退出，不能记作 PASS。

首次运行成功并关闭后，再显式执行同一命令一次，以实际重新绑定相同端口并再次关闭，证明本次清理。保存两次实际 command、exit 与结果；仅看到关闭日志或 fake-port 单元测试通过不能替代真实 HTTP 与重启证据。本文仅说明执行方式，不声明已经真实运行或验收。

## 提交与显式 hooks

提交信息使用 Conventional Commits：`feat(forms): add a resource editor`、`fix(request): reject stale results`；破坏性变更使用 `!` 或 BREAKING CHANGE footer。按项目事实选 type/scope，不新增随意的 scope 白名单。commitlint 使用 conventional 配置。

使用 `pnpm hooks:install` 显式安装唯一工具 simple-git-hooks 管理的 pre-commit/commit-msg。依赖安装和 CI 应跳过自动 hooks 安装；不设自动写当前 Git hooks 的 prepare。安装前检查当前 hooks/hooksPath 冲突，不覆盖用户已有配置。

pre-commit 只检查 staged 文件的格式与 lint，特殊文件名/rename/delete 均按 Git NUL 格式处理。部分暂存文件不覆盖未暂存字节；格式变化返回非零让开发者复核并手动暂存，不自动 git add/stash。commit-msg 只读 Git 提供的 message 文件并传给本地 commitlint。临时 Git fixture、当前仓库实际安装和后续真实提交各自留证，不能只看脚本存在就说钩子生效。

## CI 的交付边界

[CI 工作流](../../.github/workflows/ci.yml)采用官方 action 固定 SHA、Node `24.16.0`、pnpm `11.25.0`、frozen install、只读 contents 权限及同 ref concurrency；执行 `pnpm format:check` 和同一 `pnpm check`。缓存按 OS/Node/pnpm/lock 区分，恢复缓存仍校验 provenance；不缓存凭据，不运行 E2E、部署或 Docker job，不用 continue-on-error 吞失败。

工作流使用与本地一致的实际 app discovery、locale 和完整检查链。本地工作流结构检查与同命令成功只记本地证据。线上 CI 通过仍须实际 run URL、SHA 与 jobs；本地成功不能替代线上结果。

## 构建产物与预算

app 构建走 [build-app](../../internal/scripts/src/build-app.ts)，预算走 [budget](../../internal/scripts/src/budget.ts)。包 cwd 决定所选 app，多 app 根目录有歧义时显式选择，不静默套用产品 app。保留 `build-inputs.json` 的 source/toolchain/inputHash、buildContext 以及 `first-screen-roots.json` 的真实入口根；产物清单与 immutable hash seals 必须对应当前输入和上下文。旧 dist、缓存或改后的 provenance 都不能重新封印冒充当前构建。

唯一 mutable 例外是源策略声明的 `_app.config.js`：必须仍是 [canonical runtime config](./auth-request.md)，部署后可改变合法 apiURL，`generatedSha256` 保留原构建值，同时报告当前 hash/raw bytes/gzip bytes；HTML/JS/CSS/theme/roots/manifest 等 immutable 文件或额外文件变化仍拒绝。不能把“允许配置变更”扩成任意 JS 注入。

体积按实际首屏静态依赖闭包去重，逐文件 Node gzip level 6；阈值 `307_200` bytes（300 KiB），保留 `withinBudget` 真实值。当前 sizePolicy 为 `report-only`，超限不能写成达标；provenance 无效仍失败。预算报告不是浏览器网络首屏或镜像运行证据。

## Docker 与 nginx

根上下文[多阶段 Dockerfile](../../Dockerfile)的 `APP_NAME` 默认 `@niubu/playground`，可显式选现有前端；backend-mock 不进入最终生产产物。以下为本地静态服务示例，执行前确认本轮 build/run 授权和端口：

```sh
docker build --build-arg APP_NAME=@niubu/playground -t template-playground:local .
docker run --rm --name template-playground -p 8080:80 -e APP_API_URL=https://api.example.test template-playground:local
```

`APP_API_URL` 是公开 API origin，缺省保留构建值；生成器复用同一 runtime-config validator/parser/serializer，原子替换唯一配置文件，非法输入失败不启动 nginx。不从整个环境复制字段，不用 envsubst 改应用 JS。builder 运行所选 app build/budget，final 仅带静态前端、nginx 与配置生成所需 runtime，不含业务后端、源码或 node_modules。镜像和 runtime 兼容性须实际 build/run，静态检查不能证明。

nginx 将资源 base 前缀映射到原始静态文件，不改封印后的 HTML；资源 base 不替代应用的 Router basename，`/api/` 前缀保留给 API，不能用作资源 base。页面 history 路由回退 index；`/api`、`/api/` 与缺失资产明确 404；带扩展名缺失文件不回退 HTML。HTML、index 与配置 no-store；仅 fingerprinted assets 长缓存 immutable，普通资源不滥用 immutable。HEAD/GET 同一 index URL 的 ETag/Last-Modified 必须可比，HEAD 无 body，以支持更新 checker。

运行验收保存 image digest、启动日志及 index/HEAD/config/asset/route/API 404 响应，并验证同镜像两份公开配置。默认/显式 app、base 路径、容器清理与真正运行结果单列。没有镜像启动证据时写“未运行/未验收”，不能把 nginx 文本、配置生成测试或本地 CI 结果升级成 Docker PASS。
