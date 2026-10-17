import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Slider(props: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root {...props} className={cn('preference-slider relative mt-[7px] flex h-[20px] w-full touch-none items-center data-[disabled]:opacity-50', props.className)}>
      <SliderPrimitive.Track className="preference-slider-track relative h-[4px] flex-1 rounded-[4px] bg-muted">
        <SliderPrimitive.Range className="preference-slider-range absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={props['aria-label']} className="preference-slider-thumb block size-[13px] rounded-full border-2 border-primary bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring data-[disabled]:cursor-not-allowed" />
    </SliderPrimitive.Root>
  );
}
