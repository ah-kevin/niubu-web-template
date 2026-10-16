# packages 区域规则

继承[根规则](../AGENTS.md)；目录与依赖见[结构](../docs/guide/structure.md)，表单规范见[表单与 CRUD](../docs/guide/forms-query-crud.md)。

- 保持产品无关，只使用声明的公共 exports；直接依赖与构建闭包均不得反向依赖 app，不引入环。
- 包名沿用 `@niubu/*`，显示名、身份、存储命名与初始化由 app 提供，不在包顶层创建产品 owner。
- 字段遵循固定内建控件与 `custom:` 扩展；敏感值投影、请求与 lease 不另起一套实现。标准组合参考 playground 系统 CRUD，检查命令见[工程指南](../docs/guide/engineering-deploy.md)。
