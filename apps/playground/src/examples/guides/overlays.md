# 反馈示例使用指南 / Feedback examples

源码入口：`apps/playground/src/examples/components/FeedbackPage.tsx`。仓库完整指南位于 `docs/guide/forms-query-crud.md`。

- E41/E58：受控 Modal/Drawer、标题和 fullscreen、typed record props/callback、单表单 owner、确认按钮 confirmLoading。
- 表单页内提交和 footer 确认共享同一个保存门禁；关闭或卸载取消租约。重新打开会创建新内容实例。
- `OverlayProvider/useOverlay` 提供 alert/confirm 队列；卸载取消自有待办。
- E57：ReadState 的 loading/error/empty 与真实动作回调；RoutePending 仅展示路由读取状态。
- R01–R04：SystemStatePage 根据 props 呈现403/404/500和静态Offline。RouteErrorBoundary 是呈现壳，不是运行异常捕获器；没有离线检测。

缺口保留：拖拽、四向 placement、内容容器、整层 loading/lock、动画完成回调、关闭后 DOM 实例保留、prompt 及程序式 beforeClose。

Controlled overlays and typed React composition use existing public APIs. confirmLoading disables the confirm button; it is not a full-content lock or loading mask. Closing unmounts the content and retires the owned save operation.
