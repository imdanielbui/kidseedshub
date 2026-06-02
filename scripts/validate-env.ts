function hasValue(value: string | undefined) {
  return Boolean(value?.trim())
}

function isValidUrl(value: string | undefined) {
  if (!hasValue(value)) {
    return false
  }

  try {
    new URL(value as string)
    return true
  } catch {
    return false
  }
}

function validate() {
  const errors: string[] = []
  const warnings: string[] = []
  const isProduction = process.env.NODE_ENV === "production"

  if (!hasValue(process.env.DATABASE_URL)) {
    errors.push("DATABASE_URL is required.")
  }

  if (hasValue(process.env.NEXTAUTH_URL) && !isValidUrl(process.env.NEXTAUTH_URL)) {
    errors.push("NEXTAUTH_URL must be a valid URL when set.")
  }

  if (isProduction && !hasValue(process.env.NEXTAUTH_SECRET) && !hasValue(process.env.AUTH_SECRET)) {
    errors.push("NEXTAUTH_SECRET or AUTH_SECRET is required in production.")
  }

  if (isProduction && !hasValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) && !hasValue(process.env.KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS)) {
    errors.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS is required in production for class photo URL validation.")
  }

  if (!isProduction && !hasValue(process.env.NEXTAUTH_SECRET) && !hasValue(process.env.AUTH_SECRET)) {
    warnings.push("NEXTAUTH_SECRET/AUTH_SECRET is not set; development fallback secret will be used.")
  }

  if (errors.length) {
    console.error("Environment validation failed:")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  if (warnings.length) {
    console.warn("Environment validation warnings:")
    for (const warning of warnings) {
      console.warn(`- ${warning}`)
    }
  }

  console.log("Environment validation passed.")
}

validate()
