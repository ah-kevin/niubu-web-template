import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Switch(props: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn('preference-switch inline-flex h-[21px] items-center w-[36px] shrink-0 rounded-[20px] border border-border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary', props.className)}
      asChild={props.name ? true : props.asChild}
    >
      {props.name ? (
        <button type="button" name={props.name}>
          <SwitchPrimitive.Thumb className="preference-switch-thumb block size-[15px] translate-x-[2px] rounded-full bg-primary-foreground transition-transform duration-150 data-[state=checked]:translate-x-[17px] motion-reduce:transition-none" />
        </button>
      ) : (
        <SwitchPrimitive.Thumb className="preference-switch-thumb block size-[15px] translate-x-[2px] rounded-full bg-primary-foreground transition-transform duration-150 data-[state=checked]:translate-x-[17px] motion-reduce:transition-none" />
      )}
    </SwitchPrimitive.Root>
  );
}
