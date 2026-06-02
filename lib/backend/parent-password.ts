import { randomBytes } from "crypto"

const temporaryPasswordBytes = 18

function isProduction() {
  return process.env.NODE_ENV === "production"
}

export function createParentInitialPassword(phone: string) {
  if (!isProduction()) {
    return {
      plainText: phone,
      isTemporary: false
    }
  }

  return {
    plainText: randomBytes(temporaryPasswordBytes).toString("base64url"),
    isTemporary: true
  }
}
