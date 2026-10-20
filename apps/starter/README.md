# Admin Starter

管理后台样板，包含登录、首页、个人资料及用户/角色/菜单/部门四页。说明与产品生成流程见 [新产品起步](../../docs/guide/product-start.md)。

使用独立 `MOCK_PROFILE=starter` 和端口 `5330`；前端端口 `5175`。两套合成账号为 `admin@starter.invalid` 和 `viewer@starter.invalid`，密码 `demo-only`。资源 CRUD 不改变登录认证和授权，重启恢复种子。

应用持有所有 runtime owner；restore 后才初始化身份相关对象，退出/卸载时释放。测试 fixture 就近放置，公共代码不反向依赖本 app。
