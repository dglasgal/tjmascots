import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FDF6EC',
        'cream-dark': '#F5E9D7',
        'tj-red': '#C8102E',
        'tj-red-dark': '#A00D24',
        ink: '#3A2E1F',
        'ink-soft': '#6B5B45',
        accent: '#E8A87C',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(58,46,31,0.12)',
        pop: '0 20px 50px rgba(58,46,31,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
