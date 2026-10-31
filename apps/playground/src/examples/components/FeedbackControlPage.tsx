import { FeedbackPage, type FeedbackPageProps } from './FeedbackPage';
import type { FeedbackControlKind } from './control-kinds';
export type { FeedbackControlKind } from './control-kinds';

export function FeedbackControlPage({
  kind,
  ...props
}: { kind: FeedbackControlKind } & Omit<FeedbackPageProps, 'only'>) {
  return <FeedbackPage key={kind} {...props} only={kind} />;
}
