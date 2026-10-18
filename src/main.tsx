import { connect } from 'datocms-plugin-sdk';
import { Spinner } from 'datocms-react-ui';
import { lazy, Suspense } from 'react';
import { render } from './utils/render';
import 'datocms-react-ui/styles.css';
import './graph/modelColors.css';

const LazyGraphPage = lazy(() => import('./entrypoints/GraphPage'));
const LazyConfigScreen = lazy(() => import('./entrypoints/ConfigScreen'));
const LazyHelpModal = lazy(() => import('./entrypoints/HelpModal'));

connect({
  mainNavigationTabs() {
    return [
      {
        label: 'Grafo',
        icon: 'diagram-project',
        placement: ['after', 'content'],
        pointsTo: { pageId: 'graph' },
      },
    ];
  },
  renderConfigScreen(ctx) {
    render(
      <Suspense fallback={<Spinner size={30} placement="centered" />}>
        <LazyConfigScreen ctx={ctx} />
      </Suspense>,
    );
  },
  renderPage(pageId, ctx) {
    switch (pageId) {
      case 'graph':
        render(
          <Suspense fallback={<Spinner size={60} placement="centered" />}>
            <LazyGraphPage ctx={ctx} />
          </Suspense>,
        );
        break;
    }
  },
  renderModal(modalId, ctx) {
    switch (modalId) {
      case 'help':
        render(
          <Suspense fallback={<Spinner size={30} placement="centered" />}>
            <LazyHelpModal ctx={ctx} />
          </Suspense>,
        );
        break;
    }
  },
});
