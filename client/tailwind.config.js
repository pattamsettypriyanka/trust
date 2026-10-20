/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          900: '#0B0F19',
          850: '#111827',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          accent: '#3B82F6',
          accentHover: '#2563EB',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444',
          indigo: '#6366F1'
        }
      }
    },
  },
  plugins: [],
}
