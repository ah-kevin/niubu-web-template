# niubu-web-template

产品无关的 React / TypeScript Web 模板，公共包沿用 `@niubu/*` 与 `@niubu-internal/*`。仓库只包含前端示范 [Template Playground](apps/playground/README.md) 和开发后端 [backend-mock](apps/backend-mock/README.md)，不包含产品 app。

## 独立安装与启动

使用 Node `>=24.16.0`、pnpm `11.25.0`，在本仓库根目录安装；依赖、缓存与构建产物不依赖其他仓库。

```sh
SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile --ignore-scripts
# 终端一：独立 mock 服务
pnpm dev:backend-mock
# 终端二：Playground
pnpm dev
```

唯一前端自动选中 `@niubu/playground`，默认 `http://127.0.0.1:5174`；mock 由另一个终端独立提供，默认 `http://127.0.0.1:5320`；前端通过 `/api` 开发代理接入。各终端分别用 Ctrl-C 关闭自己的服务。公开合成账户与接口说明统一见 [backend-mock README](apps/backend-mock/README.md)。生产产物不包含 mock，需配置真实后端。

```sh
pnpm dev --app @niubu/playground
pnpm --filter @niubu/playground build
pnpm preview --app @niubu/playground --port 5180
```

`preview` 提供已构建静态前端，不自动启动开发 mock。新增多个前端后，应使用 `--app <workspace-name>`；无明确默认且存在多个候选时选择失败，未知应用也会失败。详见[工程与部署](docs/guide/engineering-deploy.md)。

## 开发与检查

先读[开发标准](docs/guide/standards.md)和[工作方式](docs/guide/workflow.md)，再按[开发指南](docs/guide/README.md)查具体主题。标准写法参考 [system 模块](apps/playground/src/modules/system.tsx) 和[系统 CRUD](apps/playground/src/system/ResourcePage.tsx)。

```sh
pnpm --filter '@niubu/playground...' test   # 日常：只跑改动涉及的包
pnpm check:affected                         # 日常：相对 master 有改动的包
pnpm format:check                           # 合并 master 前
pnpm check                                  # 合并 master 前
```

`pnpm check` 依次检查边界、翻译、类型、lint、测试、构建和首屏体积，不含 E2E；E2E 授权规则见 [AGENTS.md](AGENTS.md)。HTTP 运行检查 `pnpm verify:playground`、hooks、CI、构建产物与 Docker 见[工程与部署](docs/guide/engineering-deploy.md)。
