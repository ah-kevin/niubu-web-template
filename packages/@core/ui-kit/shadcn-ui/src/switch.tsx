import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Switch(props: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn('preference-switch group/switch inline-flex h-[var(--control-line-height)] w-[calc(var(--control-line-height)*2)] shrink-0 cursor-pointer items-center rounded-full border-0 bg-[var(--control-disabled-foreground)] outline-none transition-colors duration-200 enabled:hover:bg-[var(--control-tertiary-foreground)] focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-[var(--control-primary-border)] disabled:cursor-not-allowed disabled:opacity-[.65] data-[state=checked]:bg-[var(--control-primary)] enabled:data-[state=checked]:hover:bg-primary-hover', props.className)}
      asChild={props.name ? true : props.asChild}
    >
      {props.name ? (
        <button type="button" name={props.name}>
          <SwitchPrimitive.Thumb className="preference-switch-thumb pointer-events-none relative block size-[calc(var(--control-line-height)-4px)] translate-x-[2px] rounded-full before:absolute before:inset-0 before:rounded-full before:bg-primary-foreground before:shadow-[var(--control-switch-handle-shadow)] before:transition-all before:duration-200 group-active/switch:before:-right-[30%] group-active/switch:data-[state=checked]:before:right-0 group-active/switch:data-[state=checked]:before:-left-[30%] transition-transform duration-200 data-[state=checked]:translate-x-[calc(var(--control-line-height)+2px)] motion-reduce:transition-none motion-reduce:before:transition-none" />
        </button>
      ) : (
        <SwitchPrimitive.Thumb className="preference-switch-thumb pointer-events-none relative block size-[calc(var(--control-line-height)-4px)] translate-x-[2px] rounded-full before:absolute before:inset-0 before:rounded-full before:bg-primary-foreground before:shadow-[var(--control-switch-handle-shadow)] before:transition-all before:duration-200 group-active/switch:before:-right-[30%] group-active/switch:data-[state=checked]:before:right-0 group-active/switch:data-[state=checked]:before:-left-[30%] transition-transform duration-200 data-[state=checked]:translate-x-[calc(var(--control-line-height)+2px)] motion-reduce:transition-none motion-reduce:before:transition-none" />
      )}
    </SwitchPrimitive.Root>
  );
}
