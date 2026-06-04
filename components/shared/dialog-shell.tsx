"use client"

import { X } from "lucide-react"
import { useId, type FormEventHandler, type ReactNode } from "react"

type DialogSize = "sm" | "md" | "lg" | "xl"

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl"
}

type DialogShellProps = {
  title: ReactNode
  eyebrow?: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  closeLabel?: string
  size?: DialogSize
  zIndexClassName?: string
  bodyClassName?: string
  panelClassName?: string
  overlayClassName?: string
}

type DialogFormShellProps = DialogShellProps & {
  onSubmit: FormEventHandler<HTMLFormElement>
}

function DialogFrame({
  title,
  eyebrow,
  description,
  children,
  footer,
  onClose,
  closeLabel = "Đóng",
  size = "lg",
  zIndexClassName = "z-50",
  bodyClassName = "p-5",
  panelClassName = "",
  overlayClassName,
  asForm,
  onSubmit
}: DialogShellProps & { asForm?: boolean; onSubmit?: FormEventHandler<HTMLFormElement> }) {
  const titleId = useId()
  const panelClass = `neu-card flex max-h-[calc(100vh-2rem)] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-[2rem] bg-brand-bg ${panelClassName}`
  const overlayClass = overlayClassName ?? "items-center justify-center p-4"
  const content = (
    <>
      <div className="shrink-0 flex items-start justify-between gap-4 border-b border-brand-red/10 p-5">
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-widest text-brand-red">{eyebrow}</p> : null}
          <h2 id={titleId} className="mt-1 truncate text-2xl font-semibold text-brand-ink">{title}</h2>
          {description ? <div className="mt-1 text-sm leading-6 text-stone-500">{description}</div> : null}
        </div>
        <button type="button" className="neu-list-item shrink-0 rounded-2xl p-3 text-brand-red" onClick={onClose} aria-label={closeLabel}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>{children}</div>
      {footer ? <div className="shrink-0 border-t border-brand-red/10 p-5">{footer}</div> : null}
    </>
  )

  return (
    <div className={`fixed inset-0 ${zIndexClassName} !mt-0 flex ${overlayClass} bg-stone-950/35 backdrop-blur-sm`}>
      {asForm ? (
        <form className={panelClass} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={titleId}>
          {content}
        </form>
      ) : (
        <section className={panelClass} role="dialog" aria-modal="true" aria-labelledby={titleId}>{content}</section>
      )}
    </div>
  )
}

export function DialogShell(props: DialogShellProps) {
  return <DialogFrame {...props} />
}

export function DialogFormShell(props: DialogFormShellProps) {
  return <DialogFrame {...props} asForm />
}
