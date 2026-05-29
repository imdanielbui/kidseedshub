import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#a52427",
          redDark: "#7f1d20",
          redSoft: "#f8e8e8",
          cream: "#f7f1ec",
          surface: "#ede2dc",
          ink: "#2c2020",
          blue: "#2563eb",
          green: "#22c55e",
          yellow: "#facc15",
          danger: "#ef4444"
        }
      }
    }
  },
  plugins: []
}

export default config
