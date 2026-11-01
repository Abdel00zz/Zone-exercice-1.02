/** Compiled at build time; no runtime CDN or browser CSS compiler. */
module.exports = {
  content: [
    './index.html', './App.tsx',
    './{components,hooks,utils,features,domain,platform}/**/*.{ts,tsx}',
  ],
        theme: {
          extend: {
            colors: {
              dash: {
                bg: 'oklch(0.968 0.008 220)',
                sidebar: 'oklch(0.990 0.004 220)',
                card: 'oklch(0.996 0.003 220)',
                preview: 'oklch(0.945 0.008 220)',
                border: 'oklch(0.908 0.010 220)',
                main: 'oklch(0.215 0.028 240)',
                muted: 'oklch(0.465 0.020 240)',
                teal: 'oklch(0.415 0.095 205)',
                'teal-light': 'oklch(0.932 0.038 200)',
                'teal-hover': 'oklch(0.895 0.052 200)',
                sage: 'oklch(0.435 0.088 135)',
                'sage-light': 'oklch(0.938 0.038 135)',
              }
            },
            fontFamily: {
              sans: ['Plus Jakarta Sans', 'Quicksand', 'Segoe UI', 'Arial', 'sans-serif'],
              serif: ['Lora', 'STIX Two Text', 'EB Garamond', 'Georgia', 'serif'],
              display: ['Plus Jakarta Sans', 'Fredoka', 'sans-serif'],
              chapter: ['Plus Jakarta Sans', 'Lora', 'sans-serif'],
              beamer: ['Plus Jakarta Sans', 'Quicksand', 'Fira Sans', 'sans-serif'],
              latex: ['Lora', 'STIX Two Text', 'EB Garamond', 'Georgia', 'serif'],
              mono: ['Fira Code', 'ui-monospace', 'monospace'],
              handwriting: ['Playwrite FR Trad', 'Caveat', 'cursive'],
              itim: ['Itim', 'cursive', 'sans-serif'],
            },
          },
        },
      };
