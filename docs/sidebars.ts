import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'quick-start',
    {
      type: 'category',
      label: 'Platform Setup',
      link: {type: 'doc', id: 'setup/installation'},
      items: [
        'setup/installation',
        'setup/expo-plugin',
        'setup/ios-apple-pay',
        'setup/android-google-pay',
      ],
    },
    {
      type: 'category',
      label: 'Backend Processing',
      link: {type: 'doc', id: 'payment-flow'},
      items: ['payment-flow', 'guides/server-processing'],
    },
    {
      type: 'category',
      label: 'API Reference',
      link: {type: 'doc', id: 'api/use-payment-checkout'},
      items: [
        'api/use-payment-checkout',
        'api/components',
        'api/hybrid-payment-handler',
        'api/utils',
        'api/types',
      ],
    },
    {
      type: 'category',
      label: 'Recipes & Guides',
      link: {type: 'doc', id: 'guides/manual-flow'},
      items: [
        'guides/manual-flow',
        'guides/dynamic-cart',
        'guides/common-mistakes',
      ],
    },
    'troubleshooting',
    'examples',
    'compatibility',
  ],
};

export default sidebars;
