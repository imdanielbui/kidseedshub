import { FinalAssessmentPrintClient } from "./final-assessment-print-client"

type FinalAssessmentPrintPageProps = {
  params: Promise<{ id: string }>
}

export default async function FinalAssessmentPrintPage({ params }: FinalAssessmentPrintPageProps) {
  const { id } = await params

  return <FinalAssessmentPrintClient assessmentId={id} />
}
