import { usePreferenceSnapshot } from '@niubu/preferences';
/** Display-only layer. It never derives or receives business/account facts. */
export function Watermark() {
  const { core } = usePreferenceSnapshot();
  if (!core.general.watermark || !core.general.watermarkText.trim()) return null;
  return (
    <div
      className="foundation-watermark fixed inset-0 z-[39] grid grid-cols-4 grid-rows-6 overflow-hidden text-foreground opacity-10 select-none"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      {Array.from({ length: 24 }, (_, index) => (
        <span className="rotate-[-24deg] self-center p-[12px] text-center text-[1rem] wrap-anywhere" key={index}>
          {core.general.watermarkText}
        </span>
      ))}
    </div>
  );
}
