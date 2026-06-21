/** @type {import('tailwindcss').Config}
 * Flank design system (Vanilla Extract) is the source of truth for component styles.
 * Tailwind is kept for layout (flex, grid, spacing) and one-off utilities.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ABC Diatype',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      // Mirror the Flank warm-gray ramp so `bg-gray-*` utilities match the theme.
      colors: {
        gray: {
          50: '#f5f4f1',
          100: '#ecebe7',
          200: '#ddd9d1',
          300: '#cfc9ba',
          400: '#a8a394',
          500: '#6f6b60',
          600: '#54514a',
          700: '#3d3a32',
          800: '#332f29',
          900: '#2b2b28',
          950: '#1c1b18',
        },
      },
      // Barely-rounded, flat prototype look for `rounded-*` / `shadow-*` utilities.
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '2px',
        lg: '2px',
        xl: '2px',
        '2xl': '3px',
      },
      boxShadow: {
        sm: '0 0 0 1px rgb(0 0 0 / 0.08)',
        DEFAULT: '0 0 0 1px rgb(0 0 0 / 0.08)',
        md: '0 0 0 1px rgb(0 0 0 / 0.08)',
        lg: '0 0 0 1px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
