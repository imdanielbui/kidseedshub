const trustedImageHostsEnv = "KIDSEEDSHUB_TRUSTED_IMAGE_HOSTS"

function parseHosts(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  )
}

function isTrustedCloudinaryUrl(url: URL) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()

  if (!cloudName) {
    return false
  }

  return url.hostname === "res.cloudinary.com" && url.pathname.startsWith(`/${cloudName}/image/upload/`)
}

export function isTrustedClassPhotoUrl(input: string) {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    return false
  }

  if (url.protocol !== "https:") {
    return false
  }

  if (isTrustedCloudinaryUrl(url)) {
    return true
  }

  const trustedHosts = parseHosts(process.env[trustedImageHostsEnv])
  return trustedHosts.has(url.hostname.toLowerCase())
}
