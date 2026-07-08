import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".gitnexus/**",
      ".next/**",
      ".playwright-cli/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "out/**",
      "output/**",
      "public/uploads/**"
    ]
  }
]

export default config
