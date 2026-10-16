import { useState } from 'react';
import { usePreferenceManager, usePreferenceSnapshot } from '@niubu/preferences';
import {
  buildEffectiveConfiguration,
  copyEffectiveConfiguration,
  type EffectiveConfigurationExtension,
} from '@niubu/preferences/configuration';
import { PreferenceDrawer, type PreferenceDrawerProps } from './PreferenceDrawer';

export type ManagedPreferenceDrawerProps = Pick<
  PreferenceDrawerProps,
  'extensions' | 'contentId' | 'onClose' | 'returnFocus'
> & {
  configuration: () => readonly EffectiveConfigurationExtension[];
  clipboard?: { writeText: (text: string) => Promise<void> };
};

function OwnedDrawer({ configuration, clipboard, ...props }: ManagedPreferenceDrawerProps) {
  const manager = usePreferenceManager();
  const { core } = usePreferenceSnapshot();
  return (
    <PreferenceDrawer
      {...props}
      value={core}
      onChange={manager.update}
      onReset={manager.reset}
      onCopy={() => {
        const text = buildEffectiveConfiguration(manager.getSnapshot().core, configuration());
        return copyEffectiveConfiguration(text, clipboard);
      }}
    />
  );
}

/** A new manager owns fresh drafts, operation feedback, reset selection and clipboard lifetime. */
export function ManagedPreferenceDrawer(props: ManagedPreferenceDrawerProps) {
  const manager = usePreferenceManager();
  const [owner, setOwner] = useState({ manager, generation: 0 });
  if (owner.manager !== manager) setOwner({ manager, generation: owner.generation + 1 });
  return <OwnedDrawer key={owner.generation} {...props} />;
}
