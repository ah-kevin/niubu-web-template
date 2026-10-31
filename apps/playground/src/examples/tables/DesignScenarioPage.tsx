import { useLocation } from 'react-router-dom';
import { useTranslation } from '@niubu/locales/react';
import { ExamplePage } from '../ExamplePage';
import { AdvancedTables } from './AdvancedTables';
import { TreeCapabilities } from './TreeCapabilities';
import { PresentationExample } from './PresentationExample';
import { designScenarioPath, type DesignScenario } from './design-scenarios';

export function DesignScenarioPage({ scenario }: { scenario: DesignScenario }) {
  const { t } = useTranslation('app');
  const { search } = useLocation();
  return (
    <ExamplePage title={t(`designSystem.${scenario}`)} description={t('designSystem.description')}>
      {scenario === 'actions' ? (
        <PresentationExample scope={search} />
      ) : scenario === 'tree' ? (
        <TreeCapabilities />
      ) : (
        <AdvancedTables scenario={scenario} scenarioHref={key => `${designScenarioPath(key)}${search}`} />
      )}
    </ExamplePage>
  );
}
