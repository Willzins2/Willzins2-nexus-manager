/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        // Cada cor lê uma variável CSS (ver index.css) para o modo escuro funcionar sem dark: em todas as classes.
        ...Object.fromEntries(
          ['slate', 'brand', 'emerald', 'rose', 'amber', 'violet'].map((name) => [
            name,
            Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`])),
          ]),
        ),
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: { 900: '#0b1220', 800: '#111a2e', 700: '#1a2540' },
        // Tons fixos para textos sobre o fundo escuro da barra lateral (não mudam com o tema).
        mist: { 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
