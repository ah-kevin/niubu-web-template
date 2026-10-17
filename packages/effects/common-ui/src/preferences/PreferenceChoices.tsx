import { useId, type ReactNode } from 'react';
import { Check } from '@niubu/icons';

/** Internal, controlled choices retain native radio grouping and keyboard behavior. */
export function PreferenceChoices<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; preview?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="preference-choices m-0 w-full min-w-0 border-0 p-0">
      <legend className="mb-[.65rem] p-0 text-sm">{label}</legend>
      <div className="preference-choice-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] gap-2.5">
        {options.map(option => (
          <label
            className="preference-choice relative flex min-w-0 cursor-pointer flex-col items-center justify-center gap-[.55rem] rounded-lg border border-border bg-card px-2 py-3.5 text-foreground hover:bg-accent has-checked:border-primary has-checked:bg-secondary has-checked:text-primary-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-ring"
            key={option.value}
          >
            <input
              type="radio"
              className="absolute size-px p-0 opacity-0"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.preview && (
              <span
                className="preference-choice-preview flex min-h-8 w-full items-center justify-center text-foreground"
                aria-hidden="true"
              >
                {option.preview}
              </span>
            )}
            <span className="preference-choice-label max-w-full text-center text-xs leading-normal wrap-anywhere">
              {option.label}
            </span>
            <span
              className="preference-choice-check absolute top-0.5 right-1 inline-flex items-center text-primary-text leading-none [&>svg]:shrink-0"
              aria-hidden="true"
            >
              {value === option.value && <Check size={14} aria-hidden="true" />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Silhouettes follow the existing layout regions, including full-width mixed headers. */
export function LayoutPreview({ mode }: { mode: string }) {
  const full = mode === 'full-content';
  const side = !full && mode !== 'horizontal';
  const two = mode === 'two-column' || mode === 'mixed-two-column';
  const fullHeader = mode !== 'vertical' && mode !== 'two-column';
  const topNavigation = ['horizontal', 'mixed-vertical', 'mixed-two-column'].includes(mode);
  const left = side ? 24 : 0;
  const top = full ? 0 : 12;
  return (
    <svg
      className="preference-layout-preview block h-auto w-full max-w-28"
      viewBox="0 0 104 68"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        className="preference-preview-content fill-muted stroke-border"
        x="1"
        y="1"
        width="102"
        height="66"
        rx="3"
      />
      {side && (
        <rect
          className="preference-preview-navigation fill-primary"
          x="3"
          y={fullHeader ? 15 : 3}
          width={two ? 7 : 19}
          height={fullHeader ? 50 : 62}
          rx="2"
        />
      )}
      {two && (
        <rect
          className="preference-preview-secondary fill-primary opacity-45"
          x="12"
          y={fullHeader ? 15 : 3}
          width="10"
          height={fullHeader ? 50 : 62}
          rx="2"
        />
      )}
      {!full && (
        <rect
          className="preference-preview-header fill-muted-foreground opacity-[.22]"
          x={fullHeader ? 3 : left + 2}
          y="3"
          width={fullHeader ? 98 : 76}
          height="9"
          rx="2"
        />
      )}
      {topNavigation &&
        [0, 1, 2].map(index => (
          <rect
            className="preference-preview-navigation fill-primary"
            key={index}
            x={38 + index * 13}
            y="6"
            width="9"
            height="3"
            rx="1"
          />
        ))}
      <rect
        className="preference-preview-tabs fill-muted-foreground opacity-[.22]"
        x={left + 3}
        y={top + 3}
        width={98 - left}
        height="5"
        rx="1"
      />
      <rect
        className="preference-preview-page fill-background"
        x={left + 3}
        y={top + 11}
        width={98 - left}
        height={53 - top}
        rx="2"
      />
    </svg>
  );
}
