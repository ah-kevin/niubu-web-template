import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Switch(props: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn('preference-switch', props.className)}
      asChild={props.name ? true : props.asChild}
    >
      {props.name ? (
        <button type="button" name={props.name}>
          <SwitchPrimitive.Thumb className="preference-switch-thumb" />
        </button>
      ) : (
        <SwitchPrimitive.Thumb className="preference-switch-thumb" />
      )}
    </SwitchPrimitive.Root>
  );
}
