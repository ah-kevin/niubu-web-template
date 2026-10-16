import { usePreferenceSnapshot } from '@niubu/preferences';
/** Display-only layer. It never derives or receives business/account facts. */
export function Watermark() {
  const { core } = usePreferenceSnapshot();
  if (!core.general.watermark || !core.general.watermarkText.trim()) return null;
  return (
    <div className="foundation-watermark" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index}>{core.general.watermarkText}</span>
      ))}
    </div>
  );
}
