export const roles = ["ADMIN", "SALE", "TEACHER", "PARENT"] as const

export type Role = (typeof roles)[number]

export const PERMISSIONS = {
  "students:view_all": ["ADMIN", "SALE"],
  "students:view_class": ["TEACHER"],
  "students:create": ["ADMIN", "SALE"],
  "students:edit": ["ADMIN", "SALE"],
  "students:delete": ["ADMIN"],
  "enrollments:manage": ["ADMIN", "SALE"],
  "pipeline:manage": ["ADMIN", "SALE"],
  "tasks:manage": ["ADMIN", "SALE"],
  "contact_log:create": ["ADMIN", "SALE"],
  "attendance:mark": ["ADMIN", "SALE", "TEACHER"],
  "makeup:manage": ["ADMIN", "SALE", "TEACHER"],
  "photos:upload": ["ADMIN", "SALE", "TEACHER"],
  "assessments:evaluate": ["ADMIN", "SALE", "TEACHER"],
  "assessments:view": ["ADMIN", "SALE", "TEACHER"],
  "assessments:manage_rubrics": ["ADMIN"],
  "receipts:create": ["ADMIN", "SALE"],
  "expenses:create": ["ADMIN", "SALE"],
  "wallet:view": ["ADMIN", "SALE"],
  "wallet:apply_credit": ["ADMIN", "SALE"],
  "refunds:manage": ["ADMIN"],
  "finance:view_summary": ["ADMIN"],
  "finance:view_own": ["SALE"],
  "reports:view_all": ["ADMIN"],
  "reports:view_own_kpi": ["SALE"],
  "activity:view": ["ADMIN"],
  "notifications:view": ["ADMIN", "SALE", "TEACHER"],
  "settings:manage": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "courses:manage": ["ADMIN"],
  "portal:view_child": ["PARENT"],
  "portal:request_absence": ["PARENT"]
} as const satisfies Record<string, Role[]>

export type Permission = keyof typeof PERMISSIONS

type PermissionOverrideMap = Partial<Record<Permission, Role[]>>

declare global {
  var kidSeedsPermissionOverrides: PermissionOverrideMap | undefined
}

export const permissionLabels: Record<Permission, string> = {
  "students:view_all": "Xem toàn bộ học viên",
  "students:view_class": "Xem học viên theo lớp",
  "students:create": "Tạo học viên",
  "students:edit": "Sửa học viên",
  "students:delete": "Xóa học viên",
  "enrollments:manage": "Quản lý enrollment",
  "pipeline:manage": "Quản lý pipeline",
  "tasks:manage": "Quản lý task",
  "contact_log:create": "Tạo contact log",
  "attendance:mark": "Điểm danh",
  "makeup:manage": "Quản lý học bù",
  "photos:upload": "Upload ảnh lớp",
  "assessments:evaluate": "Đánh giá học viên",
  "assessments:view": "Xem đánh giá",
  "assessments:manage_rubrics": "Quản lý kỹ năng đánh giá",
  "receipts:create": "Tạo phiếu thu",
  "expenses:create": "Tạo phiếu chi",
  "wallet:view": "Xem ví học viên",
  "wallet:apply_credit": "Áp dụng credit học viên",
  "refunds:manage": "Quản lý hoàn tiền",
  "finance:view_summary": "Xem tổng quan tài chính",
  "finance:view_own": "Xem tài chính cá nhân",
  "reports:view_all": "Xem toàn bộ báo cáo",
  "reports:view_own_kpi": "Xem KPI cá nhân",
  "activity:view": "Xem log hoạt động",
  "notifications:view": "Xem thông báo nội bộ",
  "settings:manage": "Quản lý cài đặt",
  "users:manage": "Quản lý tài khoản",
  "courses:manage": "Quản lý khóa/lớp",
  "portal:view_child": "Phụ huynh xem hồ sơ con",
  "portal:request_absence": "Phụ huynh xin nghỉ"
}

export function getPermissionRoles(permission: Permission): Role[] {
  return globalThis.kidSeedsPermissionOverrides?.[permission] ?? [...PERMISSIONS[permission]]
}

export function setRuntimePermissionMatrix(entries: PermissionOverrideMap) {
  globalThis.kidSeedsPermissionOverrides = entries
}

export function can(role: Role, permission: Permission) {
  return getPermissionRoles(permission).includes(role)
}
