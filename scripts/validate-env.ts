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
  const appEnvironment = process.env.KIDSEEDSHUB_ENVIRONMENT?.trim() || (isProduction ? "production" : "local")
  const classPhotoUploadDriver = process.env.CLASS_PHOTO_UPLOAD_DRIVER?.trim() || "cloudinary"

  if (!hasValue(process.env.DATABASE_URL)) {
    errors.push("DATABASE_URL is required.")
  }

  if (isProduction && !["staging", "production"].includes(appEnvironment)) {
    errors.push("KIDSEEDSHUB_ENVIRONMENT must be staging or production when NODE_ENV=production.")
  }

  if (isProduction && appEnvironment === "production" && !hasValue(process.env.DIRECT_URL)) {
    errors.push("DIRECT_URL is required for production migration safety. Use the direct Postgres URL, not the pooled runtime URL.")
  }

  if (isProduction && appEnvironment === "staging" && !hasValue(process.env.DIRECT_URL)) {
    warnings.push("DIRECT_URL is not set. Runtime can still work, but run migrations with a direct database URL before trial go-live.")
  }

  if (hasValue(process.env.NEXTAUTH_URL) && !isValidUrl(process.env.NEXTAUTH_URL)) {
    errors.push("NEXTAUTH_URL must be a valid URL when set.")
  }

  if (hasValue(process.env.AUTH_URL) && !isValidUrl(process.env.AUTH_URL)) {
    errors.push("AUTH_URL must be a valid URL when set.")
  }

  if (isProduction && !hasValue(process.env.NEXTAUTH_SECRET) && !hasValue(process.env.AUTH_SECRET)) {
    errors.push("NEXTAUTH_SECRET or AUTH_SECRET is required in production.")
  }

  if (isProduction && process.env.AUTH_TRUST_HOST !== "true" && process.env.VERCEL !== "1") {
    errors.push("AUTH_TRUST_HOST=true is required in production unless VERCEL=1 is present.")
  }

  if (!["cloudinary", "local"].includes(classPhotoUploadDriver)) {
    errors.push("CLASS_PHOTO_UPLOAD_DRIVER must be cloudinary or local.")
  }

  if (isProduction && classPhotoUploadDriver === "local") {
    errors.push("CLASS_PHOTO_UPLOAD_DRIVER=local is only for local development or internal trials.")
  }

  if (isProduction && !hasValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) && !hasValue(process.env.KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS)) {
    errors.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS is required in production for class photo URL validation.")
  }

  if (isProduction && classPhotoUploadDriver === "cloudinary" && !hasValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)) {
    errors.push("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is required in production for Cloudinary class photo uploads.")
  }

  if (
    isProduction &&
    classPhotoUploadDriver === "cloudinary" &&
    !hasValue(process.env.CLOUDINARY_UPLOAD_PRESET) &&
    (!hasValue(process.env.CLOUDINARY_API_KEY) || !hasValue(process.env.CLOUDINARY_API_SECRET))
  ) {
    errors.push("CLOUDINARY_UPLOAD_PRESET or CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET is required in production for class photo uploads.")
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
