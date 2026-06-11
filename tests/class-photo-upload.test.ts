import assert from "node:assert/strict"
import { unlink } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { classPhotoUploadMaxBytes } from "../lib/contracts/classes"
import {
  buildCloudinarySignature,
  parseClassPhotoUploadForm,
  uploadClassPhotoFile
} from "../lib/backend/class-photo-upload"

test("parseClassPhotoUploadForm accepts a valid class photo multipart payload", () => {
  const formData = new FormData()
  const file = new File([new Uint8Array([1, 2, 3])], "lesson.jpg", { type: "image/jpeg" })

  formData.set("studentId", "student_1")
  formData.set("attendanceId", "attendance_1")
  formData.set("takenAt", "2026-06-04T10:00:00.000Z")
  formData.set("photo", file)

  const parsed = parseClassPhotoUploadForm(formData)

  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.studentId, "student_1")
    assert.equal(parsed.data.attendanceId, "attendance_1")
    assert.equal(parsed.data.isPublished, false)
    assert.equal(parsed.data.file.name, "lesson.jpg")
  }
})

test("parseClassPhotoUploadForm accepts a class session album photo without a student", () => {
  const formData = new FormData()
  const file = new File([new Uint8Array([1, 2, 3])], "class-album.jpg", { type: "image/jpeg" })

  formData.set("classSessionId", "session_1")
  formData.set("caption", "Robot demo activity")
  formData.set("isPublished", "true")
  formData.set("photo", file)

  const parsed = parseClassPhotoUploadForm(formData)

  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.studentId, undefined)
    assert.equal(parsed.data.classSessionId, "session_1")
    assert.equal(parsed.data.caption, "Robot demo activity")
    assert.equal(parsed.data.isPublished, true)
  }
})

test("parseClassPhotoUploadForm rejects unsupported photo mime types", () => {
  const formData = new FormData()
  const file = new File([new Uint8Array([1, 2, 3])], "lesson.txt", { type: "text/plain" })

  formData.set("studentId", "student_1")
  formData.set("photo", file)

  const parsed = parseClassPhotoUploadForm(formData)

  assert.equal(parsed.success, false)
  if (!parsed.success) {
    assert.equal(parsed.error.code, "PHOTO_FILE_TYPE_UNSUPPORTED")
  }
})

test("parseClassPhotoUploadForm rejects images above the upload limit", () => {
  const formData = new FormData()
  const file = new File([new Uint8Array(classPhotoUploadMaxBytes + 1)], "large.jpg", { type: "image/jpeg" })

  formData.set("studentId", "student_1")
  formData.set("photo", file)

  const parsed = parseClassPhotoUploadForm(formData)

  assert.equal(parsed.success, false)
  if (!parsed.success) {
    assert.equal(parsed.error.code, "PHOTO_FILE_TOO_LARGE")
  }
})

test("buildCloudinarySignature signs sorted upload parameters", () => {
  const signature = buildCloudinarySignature(
    {
      timestamp: "1710000000",
      folder: "kidseedshub/class-photos"
    },
    "secret"
  )

  assert.equal(signature, "a7029b71c362d7977c52337160ad1254061df042")
})

test("uploadClassPhotoFile stores images locally for trial mode", async () => {
  const previousDriver = process.env.CLASS_PHOTO_UPLOAD_DRIVER
  process.env.CLASS_PHOTO_UPLOAD_DRIVER = "local"

  try {
    const file = new File([new Uint8Array([1, 2, 3])], "Trial Lesson.JPG", { type: "image/jpeg" })
    const result = await uploadClassPhotoFile(file)

    assert.match(result.url, /^\/uploads\/class-photos\/.+-trial-lesson\.jpg$/)
    assert.match(result.cloudinaryId, /^local:/)

    await unlink(join(process.cwd(), "public", result.url.replace(/^\//, "")))
  } finally {
    if (previousDriver === undefined) {
      delete process.env.CLASS_PHOTO_UPLOAD_DRIVER
    } else {
      process.env.CLASS_PHOTO_UPLOAD_DRIVER = previousDriver
    }
  }
})
