import { connect } from 'datocms-plugin-sdk';
import { Spinner } from 'datocms-react-ui';
import { lazy, Suspense } from 'react';
import { render } from './utils/render';
import 'datocms-react-ui/styles.css';

const LazyGraphPage = lazy(() => import('./entrypoints/GraphPage'));

connect({
  mainNavigationTabs() {
    return [
      {
        label: 'Content Graph',
        icon: 'diagram-project',
        placement: ['after', 'content'],
        pointsTo: { pageId: 'graph' },
      },
    ];
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
});
