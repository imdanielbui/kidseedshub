type BrandLogoProps = {
  className?: string
  imageClassName?: string
  print?: boolean
}

export function BrandLogo({ className = "", imageClassName = "h-12 w-auto", print = false }: BrandLogoProps) {
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={print ? "/brand/kid-seeds-hub-logo-print.png" : "/brand/kid-seeds-hub-logo.png"}
        alt="Kid Seeds Hub - Trung tâm Hạt Giống Nhỏ"
        className={imageClassName}
      />
    </div>
  )
}
