import { useTranslation } from '@niubu/locales/react';
export const applicationCopy = {
  'examples.application.routedDetail': '在路由中打开隐藏详情',
  'examples.application.accessTitle': '权限与身份 / Access',
  'examples.application.accessHelp': '合成角色与授权数据，独立于当前登录。展示角色、codes any/all 和 scope 边界。',
  'examples.application.role': '合成角色',
  'examples.application.scope': '合成工作空间',
  'examples.application.write': '授予写权限',
  'examples.application.allowed': '允许',
  'examples.application.denied': '拒绝',
  'examples.application.outsideScope': '当前 scope 不在授权列表',
  'examples.application.any': 'any：至少一个 code 已授予',
  'examples.application.delete': '删除示例',
  'examples.application.manage': '管理角色操作',
  'examples.application.navigationTitle': '菜单与面包屑 / Navigation',
  'examples.application.navigationHelp':
    '合成静态页面树；文本/数字徽标、单图标激活态、逐页隐藏与安全新窗口。无 activeIcon 切换或 DOM 保活。',
  'examples.application.menu': '合成菜单',
  'examples.application.direct': '隐藏详情可直接访问',
  'examples.application.openHidden': '打开隐藏详情',
  'examples.application.back': '返回列表',
  'examples.application.frameHelp': '本地 iframe 固定容器使用现有 sandbox，撤销授权会卸载。外站 CSP 和嵌入效果未验收。',
  'examples.application.frame': '本地嵌入示例',
  'examples.application.revokeFrame': '撤销嵌入权限',
  'examples.application.restoreFrame': '恢复嵌入权限',
  'examples.application.waitingRequest': '点击按钮查看合成请求结果。',
  'examples.application.downloadFailed': '合成文件读取失败，请重试。',
  'examples.application.requestTitle': '请求与会话 / Request',
  'examples.application.requestHelp':
    '独立内存会话与合成 transport；不会请求真实服务或修改当前登录。只展示重复参数、Blob 元数据和严格过期识别，不新增无损 JSON 或 serializer 预设。',
  'examples.application.queryTitle': '安全查询与重复键',
  'examples.application.queryHelp': '保留 scope/view 等适配器参数；菜单不新增任意业务 query 字段。',
  'examples.application.repeat': '发送重复参数',
  'examples.application.download': '统一 Blob 下载',
  'examples.application.metadata': '读取下载元数据',
  'examples.application.save': '保存合成文件',
  'examples.application.cannotSave': '当前环境无法保存文件',
  'examples.application.initFailed': '合成初始化失败',
  'examples.application.expiryTitle': '严格登录失效与恢复',
  'examples.application.expired': '会话已过期，等待恢复',
  'examples.application.expiryYes': '触发过期流程',
  'examples.application.expiryNo': '不触发过期流程',
  'examples.application.normal401': '普通 401',
  'examples.application.simulate': '模拟续期失败',
  'examples.application.recover': '恢复合成会话',
  'examples.application.recoveryFailed': '恢复失败',
  'examples.application.refresh': '刷新当前示例',
  'examples.application.close': '关闭当前示例',
  'examples.application.pin': '切换固定',
  'examples.application.openDetail': '打开详情',
  'examples.application.backTabs': '返回标签示例',
  'examples.application.capacityTitle': '独立容量模型',
  'examples.application.capacityHelp':
    '合成 store 容量3，固定首页不会被淘汰；当前页和固定页受保护。与外框标签相互独立。',
  'examples.application.capacityNext': '打开下一个合成标签',
  'examples.application.capacityOutput': '容量结果',
  'examples.application.tabsTitle': '标签页 / Page tabs',
  'examples.application.tabsHelp':
    '现有 PageTabsBinding、RouteFrame 与路由身份解析器；详情实体形成不同标签。关闭/刷新会卸载组件，无 DOM 保活或动态标题覆盖。',
  'examples.application.detailTitle': '标签详情',
  'examples.application.temporary': '临时内容',
  'examples.application.temporaryHelp': '切换或刷新页面后该输入重置，明确展示没有实例保活。',
  'examples.application.page': '页面',
  'examples.application.session': '合成会话',
  'examples.application.opened': '已打开',
  'examples.application.tabsCount': '个标签；当前刷新序号',
  'examples.application.routeIdentity': '路由身份：',
  'examples.application.routeHelp': '；标题来自登记元数据，未加入动态标题API。',
} as const;
export function useApplicationText() {
  const { t } = useTranslation('app', applicationCopy);
  return (key: string) => {
    const path = `examples.application.${key}`;
    const result = t(path);
    return result === path || result === `app:${path}`
      ? (applicationCopy[path as keyof typeof applicationCopy] ?? key)
      : result;
  };
}
