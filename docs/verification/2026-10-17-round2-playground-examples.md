# 第二轮 2-3 Playground 示例交付记录

用户已在原 Case 的同一 leader 会话确认：只做“已有”及“部分”里的现有子集，缺口保留；恢复模板写入通道，必要时原生提权；验收后合并本地 master，不推送。确认原话保存在 TaskNotes 对应 Task 的业务正文。

实现提交：`dd9035d3dcec8ec31a54dc1e2dc8a76b477b139d`，功能分支 `codex/playground-example-comparison`，基线 master `6110087a2fbd3db58e5712103c290a8f100b948b`。本记录与最终本地 merge/Task 回执的准确提交由 Case 交付段保存；此文不虚构尚未执行的 Git 或 Task 生命周期操作。

## 实际范围

- 已确认的49主项现有子集映射到11个菜单入口、5个隐藏页面；加原9条，共25静态路由。逐项页/场景在 [对照与实施索引](../guide/vben-examples-comparison.md)，[执行计划](../superpowers/plans/2026-10-17-round2-playground-examples.md)。23个缺口继续保留；35个支撑文件与8个补充入口按原主项和现有边界处理。
- 表单9场景/11种控件、DataTable profiles/查询/取消、基础组件、受控反馈与状态、角色/codes/scope、嵌套/隐藏菜单/面包屑/安全外链、本地iframe、Blob/过期恢复、React Query、浏览器API和隔离偏好/水印、现有标签controller及详情身份。
- 新菜单按 `demo:read` 选中代码登记页面，north/south和两合成账号可进入。真实新窗口及隐藏详情使用当前 live scope；合成fixture不会替代当前登录授权。
- locale均为app自己的flat keys；切换语言保留字段值、实例和pending租约。文档按钮使用同app三份自包含指南，构建为独立Markdown资产。
- `packages/`、`internal/`、依赖清单和lock零改动，因此没有需要单独同步的公共代码提交。业务仓本轮源码零改动，仍master `ba023d252b34a59e882c28ab3e4881620c0d2d16`。

## 最终实际验证

所有命令使用现有工具，没有安装依赖。对模板写入及缓存输出预先使用原生提权。

| 实际命令 | 结果 |
| --- | --- |
| `pnpm format:check` | exit0；最终1.747s，`stage23-format-artifacts` |
| `pnpm check`，先移开原 `.turbo/cache`，剔除继承的 `TURBO_*` | exit0；最终80.830s，`stage23-check-artifacts`；原缓存已恢复 |
| 同一完整链的workspace/locale/type/lint/test/build/budget | 全部exit0；type54、lint54、test48、build29、budget30；Root19文件99项，Playground21文件183项，backend9文件293项，scripts16文件305项 |
| `pnpm test:integration examples-tabs.test.tsx examples-registration.test.ts` | exit0；6项，包含刷新后expiry、真实新窗口、north/south隐藏页进入与关闭 |
| `pnpm --filter @niubu/backend-mock test` | exit0；293项；完整菜单预期精确插入16页示例group，原tree/code/隔离断言保留 |
| `pnpm --filter @niubu/playground exec vitest run src/examples/forms/FormsPage.locale.test.tsx` | exit0；17项；`no-inline`资产标志变更后的定点验证 |

以上为非E2E本机验证。完整lint中有3条未改公共源码的既有Fast Refresh warning，本次app lint零警告。

### 体积报告

首屏gzip `315196` bytes，阈值 `307200`，**withinBudget=false**，超出7996 bytes。现有策略是 `report-only`，所以合法报告退出0不等于体积达标；没有放宽阈值、改封印或把false改成true。该值是构建依赖闭包报告，不是浏览器网络首屏实测。

### 生产资产核对

最终构建的三份Markdown均为真实独立文件，bytes/SHA与源码逐字一致；DocumentationLink构建模块引用这些文件，没有data URL：

| 文件 | bytes | SHA-256 |
| --- | --- | --- |
| `assets/forms-CHpa7N7l.md` | 1691 | `545dd0ce6968200b8ad54e13ed72fc2a5a1a783b6ff8affd66db83eabaf2b3d6` |
| `assets/tables-BjH7-SqI.md` | 1247 | `edf5cff1384f80ec8b32cd90ae5460a3f7565fdbdba33390527e3f678c486bcb` |
| `assets/overlays-BSftGj6D.md` | 1222 | `fb6f85cc1669e944f47b7b2b604b03f6a669cb200cd0bed055865f286c3e596b` |

76个生产JS/CSS/HTML文件无backend mock runtime sentinel命中。只读资产检查保存在本地audit的 `production-artifacts.json`；未修改构建产物或重封印。

## RED、失败及修复记录

- 初始组件真实RED→GREEN：Forms15、DataTable初始6失败→7通过、基础反馈16失败及原生submit2失败→18通过、features11失败→11通过；copy新增4失败及行copy1失败→原行为与4项切换共33通过。
- Main应用缺失实现RED→3交互通过；登记空路由RED→实际注册/后端选择通过；tabs缺controller、错误链接、commit报告转发分别修复。首次Root登记夹具路径/项目名两次错误是测试配置失败，单列保留，不计作功能RED。
- 原鉴权/锁屏16项中的2处实际回归：RouteFrame接入导致同人续期重建草稿；已保留精确identity+href的既有admission，原两套16通过。根层StrictMode新增真实RED1失败→4通过；内层StrictMode未触发effect重放的初次PASS只作夹具不足记录。
- 独立审查确认1P1+4P2：刷新后expiry旧descriptor导致nonce回落、内部新窗口404、Query返回上下文后跳过首次失败、forms初始化翻译固化、真实south隐藏链接误切north；另有doc-button支撑遗漏。均有实际独立复现与永久RED/GREEN，现已关闭。
- Query重入scope/identity永久2失败→7项通过；Forms语言17失败→32项通过，保留dirty/patch/pending signal；真实路由两失败→通过，north/south参数化再现错误后通过。

| 完整冷检查标签 | exit / 秒 | 实际原因或结果 |
| --- | --- | --- |
| `stage23-check-first` | 1 / 33.794 | React Compiler memo及prefer-const两lint，已修 |
| `stage23-check-final` | 1 / 26.594 | Main新增Root文档asset导入违反workspace边界，改同app指南，没有添加依赖或放宽规则 |
| `stage23-check-verified` | 1 / 34.211 | backend两处旧菜单精确预期未增加示例group，保留原完整断言后补齐 |
| `stage23-check-delivery` | 0 / 71.770 | 全链通过；随后产物核对发现小MD默认内联，改既有Vite `?url&no-inline` |
| `stage23-check-artifacts` | 0 / 80.830 | 最终全链通过，三份独立MD产物核对完成 |

未减断言、延长timeout、跳过原测试或吞掉失败。所有输出按对应候选保存，较早成功不冒作最终资产验证。

## 独立审查

两个reviewer未参与对应实现，均显式请求 `gpt-6.1-sol/xhigh`；实现helpers请求 `gpt-6.1-sol/high`，实际运行配置没有可信宿主回读，不把启动参数说成生效证明。

- 路由/授权/应用：最终34/34独立检查、Root29/29、backend dispatcher51/51通过；精确admission、刷新nonce、scope/菜单撤权、伪造descriptor、north/south真实新窗口/隐藏页关闭、dirty Stay、容量、StrictMode、Blob lease和合成owner隔离均已核。
- 组件/覆盖：最终74项原组件测试，独立8+8+4三命令均exit0；两个P2和文档支撑遗漏关闭，26主项及35支撑/8补充的责任边界逐项核对。`no-inline`小补丁再独审1项通过、16项未选中，未冒作17项。
- 已将审查摘要的33个组件文件（含两文件addendum）与13个路由文件逐SHA核对，零漂移。所有辅助已关闭。

## 证据与未覆盖范围

本仓忽略目录 `.superpowers/sdd/2026-10-17-round2-playground-examples/` 保存实际日志、命令JSON、逐文件hash、独立报告及私有补查；完整cold原始记录也保留在 `.superpowers/sdd/2026-10-17-round2-mock-independent/stage23-*.{json,log}`。这些本地证据未提交；本正式记录和指南/计划已纳入版本控制。

视觉由用户自行 `pnpm dev` 验收。本轮没有启动开发服务、浏览器/E2E、Docker、线上CI或真实业务HTTP；全屏/剪贴板组件替身不能当作浏览器权限验收。未触碰5173、未知服务、业务源码/公共包/依赖/凭据文件，没有push、远端删除或历史改写。根E2E授权原文684bytes及SHA `a0b911eb3b07bb4fbbac6ab5cadccc25e6c7a78d3a4f45c5314c0672df67a220`保持。

本地合并后由TaskNotes/Case登记最终提交和done/trusted gate；Case继续active，leader自然idle，等用户与原主控验收，不发通知、不park/归档/关闭。
