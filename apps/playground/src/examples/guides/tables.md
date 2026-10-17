# DataTable 示例使用指南 / DataTable examples

源码入口：`apps/playground/src/examples/tables/TablesPage.tsx`。仓库完整指南位于 `docs/guide/forms-query-crud.md`。页面记录和服务器均为合成 fixture，不访问业务 API；列偏好存入该场景的内存 owner。

- E63：`DataTable` 区分 read、list、selectable-list profiles；稳定 getRowId，客户端排序、分页和选择。
- E64：typed column helpers 与自定义状态单元格。
- E67：`useTablePreferences` 的列显隐、宽度、逻辑 start/end 固定及作用域隔离。
- E68：`useQueryDataTable` 拥有查询表单和已应用 DTO；reload 不读取尚未提交的草稿，reset 清空并再查询。
- E69：abortable server loader、分页、排序、取消与刷新；scope 更新退休旧请求，迟到响应不能覆盖新结果。

这不是 VXE API 示例。行/单元格编辑事务、固定表头、树表、已读行历史、虚拟滚动、导出和 zoom 工具条继续保留缺口。

Use the existing typed table profiles and query controller. Synthetic fixtures make sorting, paging, selection, scoped preferences and cancellation visible without real business data or services. Unsupported VXE contracts remain deferred.
