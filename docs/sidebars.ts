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
        'setup/expo-plugin',
        'setup/ios-apple-pay',
        'setup/android-google-pay',
        'setup/bare-react-native',
      ],
    },
    {
      type: 'category',
      label: 'Backend Processing',
      link: {type: 'doc', id: 'payment-flow'},
      items: ['payment-flow', 'guides/server-processing'],
    },
    'integrations/przelewy24',
    {
      type: 'category',
      label: 'API Reference',
      link: {type: 'doc', id: 'api/use-payment-checkout'},
      items: [
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
        'guides/dynamic-cart',
      ],
    },
    'troubleshooting',
    'examples',
    'compatibility',
  ],
};

export default sidebars;
