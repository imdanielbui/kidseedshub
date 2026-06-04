import { createHash } from "crypto"
import {
  classPhotoUploadAcceptedMimeTypes,
  classPhotoUploadMaxBytes
} from "@/lib/contracts/classes"

export type ParsedClassPhotoUploadForm = {
  studentId: string
  attendanceId?: string
  takenAt?: string
  isFeatured: boolean
  file: File
}

export type ClassPhotoUploadResult = {
  url: string
  cloudinaryId: string
}

export type ClassPhotoUploadParseResult =
  | { success: true; data: ParsedClassPhotoUploadForm }
  | { success: false; error: { code: string; message: string } }

type CloudinaryUploadResponse = {
  secure_url?: string
  public_id?: string
  error?: {
    message?: string
  }
}

export class ClassPhotoUploadError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "ClassPhotoUploadError"
    this.code = code
  }
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim())
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function formBoolean(formData: FormData, key: string) {
  const value = formString(formData, key).toLowerCase()
  return value === "true" || value === "1" || value === "yes"
}

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File
}

function isAcceptedImageType(type: string) {
  return classPhotoUploadAcceptedMimeTypes.includes(
    type as (typeof classPhotoUploadAcceptedMimeTypes)[number]
  )
}

function assertUploadableImage(file: File) {
  if (!file.size) {
    return { code: "PHOTO_FILE_REQUIRED", message: "Chọn file ảnh trước khi upload." }
  }

  if (file.size > classPhotoUploadMaxBytes) {
    return { code: "PHOTO_FILE_TOO_LARGE", message: "Ảnh buổi học không được vượt quá 8MB." }
  }

  if (!isAcceptedImageType(file.type)) {
    return {
      code: "PHOTO_FILE_TYPE_UNSUPPORTED",
      message: "Ảnh buổi học chỉ hỗ trợ JPG, PNG, WebP hoặc GIF."
    }
  }

  return null
}

export function parseClassPhotoUploadForm(formData: FormData): ClassPhotoUploadParseResult {
  const studentId = formString(formData, "studentId")
  const attendanceId = formString(formData, "attendanceId") || undefined
  const takenAt = formString(formData, "takenAt") || undefined
  const fileEntry = formData.get("photo") ?? formData.get("file")

  if (!studentId) {
    return { success: false, error: { code: "STUDENT_REQUIRED", message: "Thiếu học viên để gắn ảnh." } }
  }

  if (takenAt && Number.isNaN(Date.parse(takenAt))) {
    return { success: false, error: { code: "PHOTO_DATE_INVALID", message: "Thời gian chụp ảnh không hợp lệ." } }
  }

  if (!isFileEntry(fileEntry)) {
    return { success: false, error: { code: "PHOTO_FILE_REQUIRED", message: "Chọn file ảnh trước khi upload." } }
  }

  const fileError = assertUploadableImage(fileEntry)
  if (fileError) {
    return { success: false, error: fileError }
  }

  return {
    success: true,
    data: {
      studentId,
      attendanceId,
      takenAt,
      isFeatured: formBoolean(formData, "isFeatured"),
      file: fileEntry
    }
  }
}

export function buildCloudinarySignature(params: Record<string, string>, apiSecret: string) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex")
}

function getCloudinaryFolder() {
  return process.env.CLOUDINARY_CLASS_PHOTO_FOLDER?.trim() || "kidseedshub/class-photos"
}

function getCloudinaryConfig() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim()
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim()
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim()

  if (!cloudName) {
    throw new ClassPhotoUploadError("PHOTO_UPLOAD_NOT_CONFIGURED", "Chưa cấu hình Cloudinary cloud name để upload ảnh.")
  }

  if (!uploadPreset && (!apiKey || !apiSecret)) {
    throw new ClassPhotoUploadError(
      "PHOTO_UPLOAD_NOT_CONFIGURED",
      "Chưa cấu hình Cloudinary upload preset hoặc API key/secret để upload ảnh."
    )
  }

  return { cloudName, uploadPreset, apiKey, apiSecret, folder: getCloudinaryFolder() }
}

export async function uploadClassPhotoFile(file: File): Promise<ClassPhotoUploadResult> {
  const fileError = assertUploadableImage(file)
  if (fileError) {
    throw new ClassPhotoUploadError(fileError.code, fileError.message)
  }

  const config = getCloudinaryConfig()
  const formData = new FormData()
  formData.append("file", file, file.name || "class-photo")
  formData.append("folder", config.folder)

  if (config.uploadPreset) {
    formData.append("upload_preset", config.uploadPreset)
  } else {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signatureParams = {
      folder: config.folder,
      timestamp
    }

    formData.append("api_key", config.apiKey as string)
    formData.append("timestamp", timestamp)
    formData.append("signature", buildCloudinarySignature(signatureParams, config.apiSecret as string))
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: formData
  })
  const payload = (await response.json()) as CloudinaryUploadResponse

  if (!response.ok || !payload.secure_url || !payload.public_id) {
    throw new ClassPhotoUploadError(
      "PHOTO_UPLOAD_FAILED",
      payload.error?.message ?? "Không upload được ảnh lên Cloudinary."
    )
  }

  return {
    url: payload.secure_url,
    cloudinaryId: payload.public_id
  }
}

export function hasClassPhotoUploadConfig() {
  return (
    hasValue(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
    (hasValue(process.env.CLOUDINARY_UPLOAD_PRESET) ||
      (hasValue(process.env.CLOUDINARY_API_KEY) && hasValue(process.env.CLOUDINARY_API_SECRET)))
  )
}
