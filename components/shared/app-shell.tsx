"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { BarChart3, BookOpenCheck, CalendarCheck, ChevronLeft, ChevronRight, ClipboardCheck, DollarSign, LayoutDashboard, LogOut, PanelsTopLeft, Sprout, Users } from "lucide-react"

const navGroups = [
  {
    label: "Sale",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: PanelsTopLeft },
      { href: "/students", label: "Học viên", icon: Users }
    ]
  },
  {
    label: "Học tập",
    items: [
      { href: "/classes", label: "Lớp học", icon: CalendarCheck },
      { href: "/assessments", label: "Đánh giá", icon: ClipboardCheck }
    ]
  },
  {
    label: "Quản lý",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/finance", label: "Tài chính", icon: DollarSign },
      { href: "/reports", label: "Báo cáo", icon: BarChart3 },
      { href: "/settings", label: "Cài đặt", icon: BookOpenCheck }
    ]
  }
]
const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ...navGroups[0].items,
  navGroups[1].items[0]
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useSidebarState()
  const sidebarWidth = isCollapsed ? "md:pl-28" : "md:pl-72"

  return (
    <div className="min-h-screen pb-20 text-brand-ink md:pb-0">
      <aside className={`fixed inset-y-0 left-0 hidden p-5 transition-[width] duration-300 md:block ${isCollapsed ? "w-28" : "w-72"}`}>
        <div className="neu-panel flex h-full flex-col rounded-3xl p-4">
          <div className={`mb-6 flex items-center ${isCollapsed ? "justify-center" : "justify-between gap-3"}`}>
            <div className="flex items-center gap-3">
              <div className="neu-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
                <Sprout className="h-6 w-6" />
              </div>
              {!isCollapsed ? (
                <div>
                  <p className="text-lg font-semibold text-brand-red">Kid Seeds Hub</p>
                  <p className="text-xs font-medium text-stone-500">Management System</p>
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="neu-list-item mb-4 flex items-center justify-center rounded-2xl px-3 py-2 text-brand-red hover:text-brand-redDark"
            aria-label={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <nav className="space-y-4 overflow-y-auto pr-1">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                {!isCollapsed ? (
                  <p className="px-4 text-[11px] font-semibold uppercase tracking-widest text-stone-400">{group.label}</p>
                ) : (
                  <div className="mx-auto h-px w-8 bg-brand-red/10" />
                )}
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={`neu-list-item flex items-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red ${
                        isCollapsed ? "justify-center" : "gap-3"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed ? item.label : null}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
          <button
            type="button"
            className={`neu-list-item mt-auto flex items-center rounded-2xl px-4 py-3 text-sm font-semibold text-stone-600 hover:text-brand-red ${
              isCollapsed ? "justify-center" : "gap-3"
            }`}
            title={isCollapsed ? "Đăng xuất" : undefined}
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed ? "Đăng xuất" : null}
          </button>
        </div>
      </aside>
      <div className={sidebarWidth}>
        <header className="sticky top-0 z-10 p-3 md:hidden">
          <div className="neu-panel flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="neu-button flex h-10 w-10 items-center justify-center rounded-xl">
              <Sprout className="h-5 w-5" />
            </div>
            <p className="font-semibold text-brand-red">Kid Seeds Hub</p>
            <button type="button" className="ml-auto text-xs font-semibold text-brand-red" onClick={() => void signOut({ callbackUrl: "/login" })}>
              Đăng xuất
            </button>
          </div>
        </header>
        <div className="p-4 transition-[padding] md:p-8">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-brand-red/10 bg-brand-cream/90 px-3 py-2 backdrop-blur md:hidden">
          {mobileNavItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="neu-list-item flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium text-stone-600 hover:text-brand-red"
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCollapsed(window.localStorage.getItem("ksh-sidebar-collapsed") === "true")
  }, [])

  const update = (value: boolean) => {
    setIsCollapsed(value)
    window.localStorage.setItem("ksh-sidebar-collapsed", String(value))
  }

  return [isCollapsed, update] as const
}
