import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// AuthMe brand colors from themes/authme/theme.json
const authmeColors = {
  primaryColor: '#2563eb',
  backgroundColor: '#f0f2f5',
};

const config: Config = {
  title: 'AuthMe',
  tagline: 'Open-source authentication made simple',
  favicon: 'img/favicon.ico',

  url: 'https://authme.dev',
  baseUrl: '/',
  organizationName: 'authme-project',
  projectName: 'authme-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/authme-project/authme/tree/main/docs',
          routeBasePath: '/',
          docItemComponent: '@theme/DocPage',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: 'docs/api',
        routeBasePath: 'docs/api',
        sidebarPath: require.resolve('./sidebars.ts'),
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',

    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    navbar: {
      title: 'AuthMe',
      logo: {
        alt: 'AuthMe Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'mainSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/api',
          label: 'API Reference',
          position: 'left',
        },
        {
          href: 'https://github.com/authme-project/authme',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://discord.gg/authme',
          label: 'Discord',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Quickstart',
              to: '/docs/quickstart',
            },
            {
              label: 'Installation',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Configuration',
              to: '/docs/getting-started/configuration',
            },
          ],
        },
        {
          title: 'SDKs',
          items: [
            {
              label: 'React',
              to: '/docs/guides/sdks/react',
            },
            {
              label: 'Next.js',
              to: '/docs/guides/sdks/nextjs',
            },
            {
              label: 'Vue',
              to: '/docs/guides/sdks/vue',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'API Reference',
              to: '/docs/api',
            },
            {
              label: 'Deployment',
              to: '/docs/deployment/docker',
            },
            {
              label: 'Migration',
              to: '/docs/migration/keycloak',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/authme-project/authme',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/authme',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/authme',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AuthMe. Built with Docusaurus.`,
    },

    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['bash', 'yaml', 'json', 'typescript', 'javascript', 'kotlin', 'swift'],
    },

    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },

    announcementBar: {
      id: 'support_us',
      content: '⭐️ If you like AuthMe, give it a star on <a href="https://github.com/authme-project/authme" target="_blank" rel="noopener noreferrer">GitHub</a>!',
      backgroundColor: authmeColors.primaryColor,
      textColor: '#ffffff',
      isCloseable: true,
    },
  } satisfies Config['themeConfig'],
};

export default config;