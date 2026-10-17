/** App locale integration is owned by the examples module; standalone fixtures use this fallback. */
export const tablesCopy = {
  'examples.tables.title': 'DataTable 示例',
  'examples.tables.synthetic':
    '全部记录均为合成数据；服务器由本页私有 fixture 模拟，不访问业务 API。列偏好仅保存在本页会话内。',
  'examples.tables.boundary':
    '现有 DataTable 能力：只读、列表、选择、自定义单元格、列设置及查询。未实现 VXE API、单元格/行编辑、固定表头、树表、已读追踪或虚拟滚动。',
  'examples.tables.scope': '演示作用域',
  'examples.tables.north': 'North（合成）',
  'examples.tables.south': 'South（合成）',
  'examples.tables.read': '只读数据',
  'examples.tables.list': '普通列表',
  'examples.tables.client': '客户端可选列表',
  'examples.tables.server': '合成服务器列表',
  'examples.tables.name': '名称',
  'examples.tables.score': '分数',
  'examples.tables.active': '状态',
  'examples.tables.enabled': '启用',
  'examples.tables.disabled': '停用',
  'examples.tables.term': '名称包含',
  'examples.tables.query': '查询合成数据',
  'examples.tables.reset': '重置查询',
  'examples.tables.reload': '刷新已应用查询',
  'examples.tables.cancel': '取消加载',
} as const;
