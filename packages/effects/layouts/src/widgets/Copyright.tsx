import { validateCorePreferencePatch, type CorePreferences } from '@niubu/core-preferences';
/** React text and canonical URL validation preserve unknown company/registration details as empty. */
export function Copyright({ value }: { value: CorePreferences['copyright'] }) {
  if (!value.enabled) return null;
  const safe = validateCorePreferencePatch({ copyright: value }).copyright;
  return (
    <span className="foundation-copyright">
      © {value.year}{' '}
      {value.companyName &&
        (safe?.companyUrl ? (
          <a href={safe.companyUrl} target="_blank" rel="noopener noreferrer">
            {value.companyName}
          </a>
        ) : (
          <span>{value.companyName}</span>
        ))}
      {value.icpNumber && (
        <>
          {' '}
          ·{' '}
          {safe?.icpUrl ? (
            <a href={safe.icpUrl} target="_blank" rel="noopener noreferrer">
              {value.icpNumber}
            </a>
          ) : (
            <span>{value.icpNumber}</span>
          )}
        </>
      )}
    </span>
  );
}
