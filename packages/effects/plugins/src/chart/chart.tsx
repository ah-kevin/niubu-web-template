import { useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@niubu/shadcn-ui/cn';
/** shadcn ChartContainer composition, adapted to the existing semantic tokens.
 * https://ui.shadcn.com/docs/components/chart (Recharts v3, MIT).
 * Configuration is application-owned; no user-supplied CSS is evaluated. */
export type ChartConfig = Readonly<Record<string, { label: ReactNode; color: string }>>;
export function ChartContainer({
  id,
  config,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { config: ChartConfig; children: ComponentProps<typeof ResponsiveContainer>['children'] }) {
  const uniqueId = useId();
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]),
  ) as CSSProperties;
  return (
    <div
      data-slot="chart"
      data-chart={`chart-${id ?? uniqueId.replace(/:/g, '')}`}
      className={cn('chart-container', className)}
      style={style}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
