import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import harnessKitPreset from '@skillchat/harness-react/tailwind';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/react/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [harnessKitPreset as Config],
  plugins: [typography],
} satisfies Config;
