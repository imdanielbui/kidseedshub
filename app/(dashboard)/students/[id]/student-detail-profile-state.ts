import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { StudentDetail, StudentStatusKey } from "@/lib/contracts/students"

export function useStudentProfileState({
  setError,
  setPhotoCaptionDrafts,
  setStudent,
  studentId
}: {
  setError: Dispatch<SetStateAction<string | null>>
  setPhotoCaptionDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setStudent: Dispatch<SetStateAction<StudentDetail | null>>
  studentId: string
}) {
  const [profileName, setProfileName] = useState("")
  const [profileBirthDate, setProfileBirthDate] = useState("")
  const [profileStatus, setProfileStatus] = useState<StudentStatusKey>("LEAD")
  const [profileParentName, setProfileParentName] = useState("")
  const [profileParentPhone, setProfileParentPhone] = useState("")
  const [profileParentEmail, setProfileParentEmail] = useState("")
  const [profileAddress, setProfileAddress] = useState("")
  const [profileLeadSource, setProfileLeadSource] = useState("")
  const [profileLeadNote, setProfileLeadNote] = useState("")
  const [profileHealthNote, setProfileHealthNote] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const syncProfileForm = useCallback((nextStudent: StudentDetail) => {
    setProfileName(nextStudent.name)
    setProfileBirthDate(nextStudent.birthDate?.slice(0, 10) ?? "")
    setProfileStatus(nextStudent.status)
    setProfileParentName(nextStudent.parentName)
    setProfileParentPhone(nextStudent.parentPhone)
    setProfileParentEmail(nextStudent.parentEmail ?? "")
    setProfileAddress(nextStudent.address ?? "")
    setProfileLeadSource(nextStudent.leadSource ?? "")
    setProfileLeadNote(nextStudent.leadNote ?? "")
    setProfileHealthNote(nextStudent.healthNote ?? "")
  }, [])

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSavingProfile(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          birthDate: profileBirthDate ? new Date(`${profileBirthDate}T00:00:00`).toISOString() : null,
          status: profileStatus,
          address: profileAddress.trim() || null,
          leadSource: profileLeadSource.trim() || null,
          leadNote: profileLeadNote.trim() || null,
          healthNote: profileHealthNote.trim() || null,
          parent: {
            name: profileParentName.trim(),
            phone: profileParentPhone.trim(),
            email: profileParentEmail.trim() || null
          }
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được hồ sơ học viên.")
        return
      }

      setStudent(payload.data)
      setPhotoCaptionDrafts(Object.fromEntries(payload.data.photos.map((photo) => [photo.id, photo.caption ?? ""])))
      syncProfileForm(payload.data)
    } catch {
      setError("Không cập nhật được hồ sơ học viên.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  return {
    isSavingProfile,
    profileAddress,
    profileBirthDate,
    profileHealthNote,
    profileLeadNote,
    profileLeadSource,
    profileName,
    profileParentEmail,
    profileParentName,
    profileParentPhone,
    profileStatus,
    setProfileAddress,
    setProfileBirthDate,
    setProfileHealthNote,
    setProfileLeadNote,
    setProfileLeadSource,
    setProfileName,
    setProfileParentEmail,
    setProfileParentName,
    setProfileParentPhone,
    setProfileStatus,
    submitProfile,
    syncProfileForm
  }
}
