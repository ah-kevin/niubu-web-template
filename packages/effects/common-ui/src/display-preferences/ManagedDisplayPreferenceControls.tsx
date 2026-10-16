import { DisplayPreferenceControls } from './DisplayPreferenceControls';
import { useManagedDisplayPreferences } from './useManagedDisplayPreferences';

export function ManagedDisplayPreferenceControls() {
  const { preferences, update, persistence } = useManagedDisplayPreferences();
  return <DisplayPreferenceControls preferences={preferences} onChange={update} persistence={persistence} />;
}
