import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Slider(props: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root {...props} className={cn('preference-slider group/slider relative mx-[calc(var(--control-height-lg)/8)] my-[calc((var(--control-height)-var(--control-height-lg)/4)/2)] flex h-[calc(var(--control-height-lg)/4)] touch-none select-none items-center data-[disabled]:cursor-not-allowed', props.className)}>
      <SliderPrimitive.Track className="preference-slider-track relative h-[4px] flex-1 overflow-hidden rounded-[var(--control-radius-xs)] bg-[var(--control-hover-background)] transition-colors group-hover/slider:bg-[var(--control-fill-secondary)]">
        <SliderPrimitive.Range className="preference-slider-range absolute h-full bg-[var(--control-primary-border)] transition-colors group-hover/slider:bg-[var(--control-primary-border-hover)] group-data-[disabled]/slider:bg-[var(--control-disabled-background)]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={props['aria-label']} className="preference-slider-thumb relative block size-[calc(var(--control-height-lg)/4)] cursor-pointer rounded-full outline-none before:absolute before:-inset-[2px] after:absolute after:inset-0 after:size-full after:rounded-full after:bg-popover after:shadow-[0_0_0_2px_var(--control-primary-border)] after:transition-[width,height,inset,box-shadow,outline] after:duration-200 group-hover/slider:after:shadow-[0_0_0_2px_var(--control-primary-border-hover)] hover:after:-inset-[calc((var(--control-height-sm)/2-var(--control-height-lg)/4)/2)] hover:after:size-[calc(var(--control-height-sm)/2)] hover:after:shadow-[0_0_0_2.5px_var(--control-primary)] hover:after:outline-[6px] hover:after:outline-[var(--control-primary-outline)] focus:after:-inset-[calc((var(--control-height-sm)/2-var(--control-height-lg)/4)/2)] focus:after:size-[calc(var(--control-height-sm)/2)] focus:after:shadow-[0_0_0_2.5px_var(--control-primary)] focus:after:outline-[6px] focus:after:outline-[var(--control-primary-outline)] data-[disabled]:cursor-not-allowed data-[disabled]:after:shadow-[0_0_0_2px_var(--control-disabled-foreground)]" />
    </SliderPrimitive.Root>
  );
}
