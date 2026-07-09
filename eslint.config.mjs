import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const config = [
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
      "public/uploads/**",
      "scripts/imports/one-off",
      "scripts/imports/one-off/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript
]

export default config
