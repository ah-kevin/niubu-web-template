import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Slider(props: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root {...props} className={cn('preference-slider relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-50', props.className)}>
      <SliderPrimitive.Track className="preference-slider-track relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="preference-slider-range absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={props['aria-label']} className="preference-slider-thumb block size-3.5 rounded-full border-2 border-primary bg-card shadow-xs transition-shadow outline-none hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:ring-2 active:ring-ring/20 data-[disabled]:cursor-not-allowed" />
    </SliderPrimitive.Root>
  );
}
