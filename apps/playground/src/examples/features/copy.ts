import { useTranslation } from '@niubu/locales/react';
import type { TranslationParams } from '@niubu/locales';

const featuresCopy = {
  implementation: '实现说明',
  'browser.intro': '体验全屏、图标、配置复制和文本水印。',
  'browser.fullscreenIntro': '进入全屏以获得更大的工作区域。',
  'browser.watermarkIntro': '修改文字并开启水印，立即查看效果。',
  'browser.iconsIntro': '按名称读取图标，并查看未登记图标的回退。',
  'query.intro': '切换演示上下文，体验分页、重试、缓存与加载更多。',
  'preferences.intro': '调整业务布局与摘要显示，实时预览偏好设置。',
  'preferences.settingsIntro': '应用预设或调整摘要显示，右侧立即预览。',
  'query.contextTitle': '合成上下文',
  'preferences.preview': '业务布局预览',
  'preferences.previewItem': '演示项目 {{item}}',
  'browser.watermarkHelp': '启用后在整个应用显示演示水印；关闭只影响本页的合成偏好。',
  'query.pageRow': '{{context}} · 第 {{page}} 页 · 条目 {{id}}',
  'query.moreRow': '{{context}} · 更多条目 {{id}}',

  'browser.title': '浏览器现有能力',
  'browser.help': '合成数据；配置和水印使用独立内存偏好，不读取或修改当前用户偏好。复制与全屏按钮调用真实浏览器 API。',
  'browser.fullscreen': '根文档全屏',
  'browser.toggleFullscreen': '切换根文档全屏',
  'browser.fullscreenStatus': '全屏状态：{{status}}',
  'browser.fullscreenHelp': '使用浏览器根 documentElement；浏览器拒绝或不支持时显示实际状态。',
  'browser.configuration': '配置复制',
  'browser.copy': '复制演示配置',
  'browser.copied': '配置已复制',
  'browser.copyFailed': '复制不可用，请手动复制下方配置',
  'browser.manualCopy': '可手动复制的配置',
  'browser.copyHelp': '仅复制已校验的演示配置。',
  'browser.watermark': '文本水印',
  'browser.showWatermark': '显示演示水印',
  'browser.watermarkText': '演示水印文本',
  'browser.icons': '显式图标登记',
  'browser.iconLabel': '图标 {{name}}',
  'browser.iconRegistered': '{{name}}：已登记',
  'browser.iconMissing': '{{name}}：未登记',
  'preferences.title': '业务偏好扩展',
  'preferences.help': '合成数据；独立内存偏好，不读取或修改当前用户偏好，离开页面即清理。',
  'preferences.extension': '业务 PreferenceExtension',
  'preferences.summaryStatus': '业务视图：{{layout}} / 摘要：{{summary}}',
  'preferences.visible': '显示',
  'preferences.hidden': '隐藏',
  'preferences.widePreset': '应用宽屏预设',
  'preferences.showSummary': '显示业务摘要',
  'preferences.reset': '重置业务扩展',
  'preferences.wide': '宽屏业务视图',
  'preferences.balanced': '均衡业务视图',
  'preferences.summary': '合成业务摘要：3 个演示项目',
  'preferences.metadata': 'namespace: {{namespace}} / version: {{version}} / scope: synthetic-business',
  'preferences.initializing': '正在初始化合成偏好…',
  'query.title': 'TanStack React Query',
  'query.help': '合成数据与延迟/失败 fixture；不请求真实账号。页面拥有独立 QueryClient，离开时取消并清空。',
  'query.identity': '合成 identity',
  'query.scope': '合成 scope',
  'query.generation': '更新合成 generation',
  'query.context': '当前合成上下文：{{context}}',
  'query.pagination': '分页查询',
  'query.page': '当前页：{{page}}',
  'query.previousData': '保留上一页数据',
  'query.loadingPage': '正在加载分页…',
  'query.previous': '上一页',
  'query.next': '下一页',
  'query.retry': '安全 GET 重试',
  'query.retryHelp': '仅这个合成 GET 场景允许最多重试一次；失败由 queryFn 抛出。',
  'query.retryOnce': '重试一次后成功',
  'query.fail': '持续失败',
  'query.runningGet': '正在执行 GET（含重试）…',
  'query.attempts': '{{value}}；尝试：{{attempts}}',
  'query.concurrent': '并发与缓存',
  'query.concurrentHelp': '同时 fetchQuery 两次；60 秒内重复读取使用同键缓存。',
  'query.concurrentRead': '并发读取同一键',
  'query.concurrentPending': '正在并发读取…',
  'query.concurrentResult': '底层 GET 次数：{{attempts}}；两次结果相同：{{same}}',
  'query.yes': '是',
  'query.no': '否',
  'query.readFailed': '合成读取失败',
  'query.more': '加载更多',
  'query.initialLoading': '正在加载首批…',
  'query.exhausted': '没有更多数据',
} as const;
const featuresFallback = Object.fromEntries(
  Object.entries(featuresCopy).map(([key, value]) => [`examples.features.${key}`, value]),
);
const featuresKeys: ReadonlyMap<string, string> = new Map(
  Object.entries(featuresCopy).map(([key, value]) => [value, `examples.features.${key}`]),
);

export function useFeaturesText() {
  const { t } = useTranslation('app', featuresFallback);
  return {
    t: (key: keyof typeof featuresCopy, params?: TranslationParams) => t(`examples.features.${key}`, params),
    localize: (value: string) => {
      const key = featuresKeys.get(value);
      return key ? t(key) : value;
    },
  };
}
