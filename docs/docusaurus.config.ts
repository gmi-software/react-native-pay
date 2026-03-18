import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "React Native Pay",
  tagline:
    "Unified Apple Pay and Google Pay for React Native with a single, type-safe API.",
  favicon: "img/favicon.ico",

  future: {
    v4: true,
  },

  url: "https://gmi-software.github.io",
  baseUrl: "/react-native-pay/",

  organizationName: "gmi-software",
  projectName: "react-native-pay",

  onBrokenLinks: "throw",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "docs",
          editUrl:
            "https://github.com/gmi-software/react-native-pay/tree/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "React Native Pay",
      logo: {
        alt: "React Native Pay",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "dropdown",
          position: "left",
          label: "Docs",
          items: [
            { to: "/docs/intro", label: "Introduction" },
            { to: "/docs/quick-start", label: "Quick Start" },
            { to: "/docs/setup/installation", label: "Platform Setup" },
            { to: "/docs/payment-flow", label: "Backend Processing" },
            { to: "/docs/integrations/przelewy24", label: "Integrations" },
            { to: "/docs/api/use-payment-checkout", label: "API Reference" },
            { to: "/docs/guides/manual-flow", label: "Recipes & Guides" },
            { to: "/docs/troubleshooting", label: "Troubleshooting" },
            { to: "/docs/examples", label: "Examples" },
            { to: "/docs/compatibility", label: "Compatibility" },
          ],
        },
        {
          to: "/docs/quick-start",
          label: "Quick Start",
          position: "left",
        },
        {
          type: "search",
          position: "right",
        },
        {
          href: "https://github.com/gmi-software/react-native-pay",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            { label: "Introduction", to: "/docs/intro" },
            { label: "Quick Start", to: "/docs/quick-start" },
            { label: "API Reference", to: "/docs/api/use-payment-checkout" },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/gmi-software/react-native-pay",
            },
            {
              label: "Issues",
              href: "https://github.com/gmi-software/react-native-pay/issues",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} GMI Software. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
