import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';
import { cn } from './cn';
export function Slider(props: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root {...props} className={cn('preference-slider', props.className)}>
      <SliderPrimitive.Track className="preference-slider-track">
        <SliderPrimitive.Range className="preference-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={props['aria-label']} className="preference-slider-thumb" />
    </SliderPrimitive.Root>
  );
}
