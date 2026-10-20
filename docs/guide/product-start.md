# 新产品起步

`apps/starter` 是参与完整检查的管理后台起点，`apps/playground` 保留为组件参考。两者没有互相导入。新产品生成后只有 `apps/web` 产品 app，仍保留 Playground 和开发 mock。

## 在模板查看样板

分别在两个终端运行：

```sh
MOCK_PROFILE=starter pnpm dev:backend-mock --port 5330
pnpm dev -- --app @niubu/starter
```

前端地址 `http://127.0.0.1:5175`，开发代理默认连接 `5330`。两个服务各自由启动者管理，前端不隐式启动或接管 mock。Playground 的默认 mock 配置和 `5320/5174` 不变。

合成账号为 `admin / admin`、`viewer / viewer`。只读账号只有资源 read codes。公开菜单为空，登录后进入默认 workspace。请勿在此填写真实凭据。

用户和角色是分页表格，菜单和部门是树表。四页资源变动只保存在当前 mock 实例中；不会改变登录账号、会话或实际授权，重启恢复种子。角色 `code` 是资源标识，不是权限编辑器。

## 生成独立产品

生成器读取明确的 Git commit，忽略未提交工作区。目标必须是仓库外的全新空目录，父目录必须存在且路径不能经过符号链接。生成器不安装、不启动服务、不建 Git、不提交或推送。

先 dry-run 并记录输出的 `templateCommit`：

```sh
pnpm create:product -- --target-dir ../inventory-web --product-slug inventory \
  --name-zh 库存管理 --name-en Inventory --dry-run
```

审阅来源、身份和文件清单后，用同一个完整 commit 执行：

```sh
pnpm create:product -- --target-dir ../inventory-web --product-slug inventory \
  --name-zh 库存管理 --name-en Inventory --template-ref <完整commit> --apply
```

默认保留 `@niubu/*`。生成时可显式增加 `--public-scope @acme`，整体转换公开包的 manifest、依赖、imports、工具配置、文档及 lock 的引用；`@niubu-internal/*` 保持。首版 scope 支持小写字母、数字和连字符，不支持内部工具 scope 改名。模板仓和现有业务仓不会因此改变。

scope 还必须符合来源 commit 的公共包边界规则；与禁用业务词冲突时，dry-run 会拒绝并说明原因。重复 CLI 参数同样拒绝，不采用最后一个值静默覆盖。

生成结果的 `.template-source.json` 记录来源 commit/时间、产品输入、公开/内部 scope 和逐文件 hash/mode；它是生成来源记录，不替代 build-app 的构建 provenance。相同输入产生相同源码与 manifest。遇到非空目标、非法输入或不支持的结构时拒绝写入，没有 force 模式；不会覆盖已有产品来“升级”。

## 安装、格式与验证

生成完成只表示文件已经落盘。授权安装后，在新目录分别执行：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm format
pnpm check
pnpm format:check
```

不新增第三方依赖或修改 catalog 版本。lock/importer 不一致时停止并核对来源，不能放宽供给链策略。产品文案和 scope 变化后先由既有 Prettier 统一文本格式；保留模板检查和 Playground 参考检查。

新产品 mock 默认采用产品 profile。另启一个 mock 端口后，前端使用 `MOCK_API_URL=http://127.0.0.1:<端口> pnpm dev -- --app <公开scope>/web`。查看 Playground 时显式选择 `MOCK_PROFILE=playground`；两套前端连接各自配置和端口，不混用菜单。

构建选中产品 app：`pnpm --filter <公开scope>/web build`。生产只交付该 app 的静态产物，mock 不属于生产服务。真实后端接入、动态授权联动、已有产品迁移和发布都需要独立合同。

## 初始化之后的开发

初始化生成器只负责第一次创建产品目录。后续由 Agent 按根 `AGENTS.md` 和[开发指南](./README.md)编写普通源码，在产品自身 `apps/web` 中显式接线，不通过重新生成覆盖已有定制。

- 新页面按[模块接入清单](./modules.md)登记稳定 pageId、静态 loader、registry、菜单权限、语言和样式；查询列表与编辑再按[表单清单](./forms-query-crud.md)接入。
- Starter 提供产品装配参考，Playground 提供组件示例；生成产品内以自身 app、实际公开 scope 和现有 mock profile 为准，app 之间不互导私有实现。
- 测试使用[现有装配与检查入口](./engineering-deploy.md)，模板更新按[工作方式](./workflow.md)核对差异；`.template-source.json` 保留初始化来源，不能改写它来隐藏后续定制。
