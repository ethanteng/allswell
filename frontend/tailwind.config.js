/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f5f4ef',
        surface: '#fffdf8',
        ink: {
          DEFAULT: '#17251f',
          muted: '#5c6b63',
          faint: '#8a968f',
        },
        sage: {
          50: '#eef5f1',
          100: '#dfeee7',
          200: '#bcd9cc',
          500: '#3f7f6d',
          600: '#2f6f5e',
          700: '#255a4c',
        },
        clay: {
          50: '#fdf2ea',
          100: '#f8e3d2',
          500: '#b5713c',
          700: '#8a5228',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
