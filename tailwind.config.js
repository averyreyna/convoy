/** @type {import('tailwindcss').Config}
 * Design system (Vanilla Extract) is the source of truth for component styles.
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
    },
  },
  plugins: [],
};
