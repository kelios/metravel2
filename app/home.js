import { createElement } from 'react';

export default function Home() {
  return createElement(
    'main',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' } },
    createElement('p', null, 'Home Screen')
  );
}
