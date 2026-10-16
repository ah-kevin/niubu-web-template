import type { SystemStatePageProps } from './SystemStatePage';
import { SystemStatePage } from './SystemStatePage';

/** No provider, router or locale owner is required during failed initialization. */
export function StartupError(props: SystemStatePageProps) {
  return (
    <main>
      <SystemStatePage {...props} />
    </main>
  );
}
