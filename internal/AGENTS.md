# internal 区域规则

继承根规则。命令见[工作方式](../docs/guide/workflow.md)和[工程与部署](../docs/guide/engineering-deploy.md)。两个仓库的本文件逐字一致。

- 只放 Node 工具，以及构建、lint、测试、TypeScript 的共享配置。不放产品运行时代码，也不依赖 app。
- 测试共享配置在 `test-config`，本地测试默认最多2个worker，CI=true/1保留50%策略；测试包串行，同仓多Agent协调重检查。
- 修改 `turbo.json` 的缓存输入后，用 `turbo run <任务> --dry=json` 对比改动前后的任务哈希，确认该失效的任务确实会失效。
- 构建产物的来源记录和首屏体积报告不能手工改写。体积超出预算就如实报告。
- 不为了让检查通过而另装工具，或放宽依赖安全策略。
