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

先读[开发指南](docs/guide/README.md)，从 [system 模块](apps/playground/src/modules/system.tsx) 和[系统 CRUD](apps/playground/src/system/ResourcePage.tsx) 接入模块、权限、表单与请求。产品显示名、身份和存储命名由 app 配置。通用偏好保留 86 字段、15 主题和 7 布局。

```sh
pnpm --filter @niubu/common-ui typecheck
pnpm --filter '@niubu/playground...' test
pnpm test:integration
pnpm format:check
pnpm check
```

Root 的 14 个既有 integration 测试文件继续保留；`pnpm test` 先运行 Root integration，再运行各包测试。`pnpm check` 按 workspace/boundary → locale → typecheck → lint → test → build → budget 执行完整非 E2E 检查，focused 检查不能替代它。E2E 授权规则见 [AGENTS.md](AGENTS.md)。格式检查独立执行，完整检查失败时先修复对应错误再提交。

## 显式 HTTP 运行检查

在根目录显式运行，首次成功后再运行同一命令，以重新绑定相同端口验证清理：

```sh
pnpm verify:playground
pnpm verify:playground
```

该入口只检查前端 HTML 和 Vite 代理的 health/echo，不验证浏览器渲染、登录或业务操作，也不加入默认 check/test/CI。启动及所有 HTTP 操作共用 30 秒截止时间；finally 只清理自己创建的 owner，成功路径也须等待 `owned server.close()` 完成才报告 `cleaned: true`，任何检查或清理失败均不算通过。该诊断命令自己管理临时服务，应在手动开发服务关闭后使用；详见[工程指南](docs/guide/engineering-deploy.md)。

## 工程交付

依赖统一使用 [catalog 与 trust 策略](pnpm-workspace.yaml) 和单一 [lockfile](pnpm-lock.yaml)，不放宽安装策略。Conventional Commits 与显式 `pnpm hooks:install` 见[工程指南](docs/guide/engineering-deploy.md)；依赖安装不自动安装 hooks。

[CI 源码](.github/workflows/ci.yml)执行 frozen install、格式与完整检查；本地同命令结果和线上 CI 结果分别验收。[Dockerfile](Dockerfile) 与 [nginx 配置](deploy/nginx.conf) 延续静态前端交付方案；构建与部署方式见[工程指南](docs/guide/engineering-deploy.md)。

预算阈值为 `307_200` bytes（gzip level 6），保持 `report-only`，记录实际 `withinBudget`；超限不等于达标，provenance 无效仍失败。运行配置仅允许 canonical `_app.config.js` 的公开 `apiURL`，详见[鉴权与请求](docs/guide/auth-request.md)。浏览器、生产部署与用户验收需各自的实际证据。
