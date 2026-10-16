# internal 区域规则

继承[根规则](../AGENTS.md)；职责见[结构](../docs/guide/structure.md)，命令与产物契约见[工程指南](../docs/guide/engineering-deploy.md)。

- 只提供 Node 工具与构建/lint/test 配置，不引入产品运行时或对 app 的构建依赖；维护 source exports 与测试归属。
- app 选择基于实际 workspace，拒绝未知与歧义；不能为模板 fixture 跳过当前 Root 或产品检查。
- 保留 source/context/provenance、immutable seals 与 canonical 单文件 runtime-config 例外；缓存、部署不可重新封印篡改产物。
- 不为方便检查另装解析器或绕过依赖包龄/trust 策略；新增依赖先按项目规范核验。标准使用方见 playground，不能把静态检查称作线上 CI 或镜像运行通过。
