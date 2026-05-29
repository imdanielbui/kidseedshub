# Kid Seeds Hub Full Product Plan

Status legend:

- `Todo`: not started.
- `Doing`: implementation is in progress.
- `Verified`: implemented and checked.
- `Blocked`: waiting on a product, data, environment, or technical decision.

Checkbox rule: only change `[ ]` to `[x]` after the item is implemented and verified.

## Summary

Kid Seeds Hub is a web-based internal management system for a small STEM/Robotics education center. The product covers CRM, students, classes, attendance, FUN/Robotics assessment, finance, parent-facing workflows, reports, and operations.

V1 is not the full 50-feature product. V1 must be enough to run the center and collect revenue: lead pipeline, student records, class/attendance, session balance, weekly assessment, final assessment, receipts, expenses, basic reports, exports, and fixed RBAC.

## Product Phases

- [ ] Phase 0 - Spec Lock: lock business rules, roles, data model, and assessment model. Status: Todo.
- [x] Phase 1 - Foundation: app shell, auth, RBAC, Prisma/Postgres, seed data. Status: Verified.
- [x] Phase 2 - MVP Revenue Flow: lead -> trial -> paid -> attendance -> renewal alert. Status: Verified.
- [x] Phase 3 - Weekly Assessment: FUN weekly observation + Robotics 8-skill star scoring. Status: Verified.
- [x] Phase 4 - Final Assessment: aggregate final assessment from weekly data. Status: Verified.
- [x] Phase 5 - Finance & Export: receipts, expenses, finance dashboard, Excel export. Status: Verified.
- [x] Phase 6 - Parent Portal: parent sees sessions, photos, reports, absence requests, and after-course feedback. Status: Verified.
- [x] Phase 7 - Automation & Analytics: Zalo templates, reminders, retention, forecast. Status: Verified.
- [x] Phase 8 - Scale/Ops: import, audit log, backup, permission matrix, QR attendance. Status: Verified.

## 50 Feature Matrix

### Module 1 - Sale Pipeline & CRM

- [x] 1. Lead profile - V1. Status: Verified. Verify: Admin-authenticated smoke test created lead `Smoke Revenue Flow` with parent contact/source through `POST /api/students`; `GET /api/students/:id` returned the profile. Pipeline metadata enhancement verified UI-created `Lead Compact Smoke` with generated student code, gender, created-by, created/updated dates, optional class/sale assignment fields, and click-to-open quick profile dialog with parent summary, status action, latest contact history, next tasks, and CTA to full student profile. `/students` and `/pipeline` now use shared `LeadFormPanel` and the same backend payload fields; student codes use compact format `KSYY-###`.
- [x] 2. Five-stage pipeline - V1. Status: Verified. Verify: DB smoke lead `Pipeline Five Stage Smoke` moved through CRM stages through `PATCH /api/students/:id/status`; `/pipeline` supports drag/drop board, explicit status select, compact paginated database view with server filter/sort, hide/reorder fields like a Notion database, `Ngày ở bước này` from `stageChangedAt`, filter-aware stage chips/full-width Kanban columns, and Nurture for cold leads; shared status logic activates the parent account when moved to `CONVERTED` or `ACTIVE`.
- [x] 3. Contact history - V1. Status: Verified. Verify: `POST /api/students/:id/contact-logs` created `CRUD smoke contact log`; `GET /api/students/:id` returned the timestamped contact log.
- [x] 4. Alert dashboard - V1. Status: Verified. Verify: Admin-authenticated `GET /api/dashboard/alerts` returned low-session, stale-trial, and due-task data from seeded DB.
- [x] 5. Lead source tracking - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned `leadSources` grouped by source with lead count, converted count, and conversion rate; `/reports` renders the source analytics panel.
- [x] 6. Task reminder - V1. Status: Verified. Verify: `POST /api/tasks` created `CRUD smoke follow-up`; `PATCH /api/tasks/:id` marked it `DONE`; student detail returned the completed task.
- [x] 7. Zalo message templates - Phase 2. Status: Verified. Verify: `GET /api/message-templates` returned approved template `TUITION_LOW_SESSIONS`; `/finance` lets staff select approved Zalo templates and previews generated messages.

### Module 2 - Student Management

- [x] 8. Full student profile - V1. Status: Verified. Verify: `GET /api/students/:id` returned parent, parent account status, generated student code, course, class, contact/task arrays, and session summary for the smoke student; `/students` supports list and database views with search, status filter, sort, pagination, hide/reorder fields, and shared lead form; student detail uses tabs for overview, CRM, learning, finance, journal, and parent account. The `Học tập` tab now opens compact detail dialogs when staff click a registered course or class item.
- [x] 9. Session balance - V1. Status: Verified. Verify: receipt added 12 sessions to the new enrollment; attendance marked present once; student detail returned `sessionsBought: 12`, `sessionsUsed: 1`, `sessionsRemaining: 11`.
- [x] 10. Learning timeline - Phase 2. Status: Verified. Verify: Student Detail API now returns a chronological `learningTimeline` from registered courses, attendance, class photos, weekly assessments, and final assessments; Playwright verified `/students/cmp3bby2o000vpruxbibpq6fm` -> `Học tập` renders `Timeline học tập` with weekly assessment and course milestones.
- [x] 11. Student photo album - V1. Status: Verified. Verify: `POST /api/class-photos` attached `https://example.com/kidseedshub-smoke-photo.jpg` to `Smoke Revenue Flow Updated`; `GET /api/students/:id` returned it in `photos` with `takenAt` and `attendanceId`.
- [x] 12. Groups/classes - V1 minimal. Status: Verified. Verify: smoke enrollment assigned the student to `Robotics Demo - Hôm nay`; `GET /api/classes/today` returned that student in the class; `/classes` now uses a browser-like tab layout for `Lớp hôm nay`, `Lịch tháng`, and `Thiết lập`; Admin can create one recurring class/course schedule, select students for the class roster, generate weekly `ClassSession` rows, open the calendar fullscreen, manage holiday/event blocks, and drag individual sessions to another date or mark them scheduled/completed/canceled. The `Thiết lập` tab now has compact sub-panels for `Quản lý lớp`, `Tạo lớp`, and `Lịch nghỉ` to reduce page scroll while preserving all fields; it includes a searchable/filterable class-management list, class detail dialog for course ownership/roster/schedule slots/generated session count/active status, and a one-click `Nạp lễ/sự kiện VN YYYY` action that creates official Vietnam holiday blocks plus center event markers such as 20/11.
- [ ] 13. Health and special notes - Phase 2. Status: Todo. Verify: teacher-visible notes can be recorded safely.

### Module 3 - Attendance & Classes

- [x] 14. One-tap attendance - V1. Status: Verified. Verify: Admin-authenticated `POST /api/attendance` marked the smoke enrollment `PRESENT`; repeated same-day mark updated existing attendance instead of creating a duplicate.
- [x] 15. Automatic session deduction - V1. Status: Verified. Verify: present attendance incremented `sessionsUsed` from 0 to 1 and left repeat same-day `PRESENT` at 1.
- [x] 16. Class photo upload - V1. Status: Verified. Verify: `POST /api/class-photos` saved a photo URL against the smoke attendance; `GET /api/classes/today` returned `photoCount: 1`.
- [x] 17. Lesson notes - V1. Status: Verified. Verify: `POST /api/attendance` updated the smoke attendance note to `Smoke lesson note and photo`; `GET /api/classes/today` returned it as `attendanceNote`.
- [x] 18. Makeup schedule - Phase 2. Status: Verified. Verify: approved parent absence creates `ABSENT_EXCUSED` attendance without deducting sessions; `GET /api/makeup-schedules` returned the excused absence and `PATCH /api/makeup-schedules/:id` saved `makeupDate: 2026-05-27`.
- [x] 19. QR attendance - P3. Status: Verified. Verify: `POST /api/attendance/qr` with `KSH:ENROLLMENT:cmp3bby2u0015pruxu8z76e33` marked `Trần Bảo Ngọc` as `PRESENT`, incremented sessions used to 1, returned remaining sessions, and wrote audit action `attendance.qr_mark`; `/classes` renders the QR Attendance panel.

### Module 4 - Assessment

- [x] 20. Robotics 8-skill evaluation - V1. Status: Verified. Verify: Robotics now uses a dedicated class workflow with 8 fixed skills (`Logic`, `Thuật toán`, `Sáng tạo`, `Giải quyết vấn đề`, `Kiên trì`, `Thuyết trình`, `Làm việc nhóm`, `Lãnh đạo`) scored 1-5 stars. `AssessmentItemResult.score` is nullable for backward compatibility, old `progressLevel` data maps to score fallback, and Playwright verified Teacher Robotics can score/save/reload a student on `/assessments`.
- [x] 21. Progress charts - Phase 2. Status: Verified. Verify: Student Detail API returns `assessmentProgress` per registered course with completed weeks, latest week, checked checklist count, and final-assessment state; `/students/:id` renders compact progress bars in `Tiến độ đánh giá`.
- [x] 22. Final course PDF report - Phase 2. Status: Verified. Verify: `npm run typecheck`, `npm run lint`, and `npm run build` passed; migration `20260524152000_dynamic_rubrics_final_reports` applied on local Postgres; `/final-assessments/:id/print` renders an A4 report page with `In / Lưu PDF`; parent portal only lists `PUBLISHED` final reports.
- [x] 23. Standardized rubric - V1. Status: Verified. Verify: Dynamic `AssessmentRubricConfig` stores versioned FUN/Robotics rubrics with Draft/Active/Archived states; `npm run prisma:seed` seeds the legacy `FUN_RUBRIC` and `ROBOTICS_RUBRIC` as active configs; Settings now includes `Kỹ năng đánh giá` for adding/removing/reordering skills and checklist outcomes.
- [ ] 24. Class skill comparison - Phase 2. Status: Todo. Verify: admin can compare class averages by skill.
- [x] 24A. Weekly assessment for FUN - V1 add-on. Status: Verified. Verify: `/assessments` now evaluates by class; choosing a FUN class automatically uses the active FUN rubric without a subject selector, saves per-student weekly checklist snapshots, and keeps weekly data internal.
- [x] 24B. Weekly assessment for Robotics - V1 add-on. Status: Verified. Verify: `/assessments` now evaluates by class; choosing a Robotics class automatically uses the active Robotics score rubric without a subject selector, shows a compact student list, 8 star-score cards, radar preview, age-group label/default fallback, auto comments, and keeps weekly data internal.
- [x] 24C. Final assessment gated by weekly checks - V1 add-on. Status: Verified. Verify: final report APIs require completed weekly assessments, support class-level `Tạo & gửi cả lớp`, skip students missing required weekly data, and expose reports to parents only after `PUBLISHED`.

### Module 5 - Finance & Tuition

- [x] 25. Tuition receipt - V1. Status: Verified. Verify: Admin-authenticated `POST /api/receipts` created `PT-2026-004` for the smoke enrollment, saved amount/method/creator/date, and incremented enrollment sessions. Extended mid-course receipt smoke created `PT-2026-006` from Student Detail with 10 billable sessions, 2 free-trial sessions, 3 paid-before-receipt sessions, gross `2,500,000`, cash discount `100,000`, percent discount `10%`, final amount `2,150,000`, remaining sessions `8`, and `/receipts/:id/print` rendered the printable receipt. Multi-course receipt smoke created `PT-2026-008` from Student Detail for Robotics + FUN in one payment; the print page rendered `2 khóa đã đăng ký` with two `ReceiptLine` rows. Student Detail finance history now loads all receipts for one student through `GET /api/receipts?studentId=...`; demo student `cmp6ekscy0004pr90eps4b5z6` has course, monthly, and three-course receipt cases visible in `Lịch sử phiếu thu`.
- [x] 26. Expense management - V1. Status: Verified. Verify: Admin-authenticated `POST /api/expenses` created `PC-2026-003` with category `MATERIALS`, amount `123456`, description, date, and creator; `GET /api/expenses?month=2026-05` returned it.
- [x] 27. Finance dashboard - V1. Status: Verified. Verify: `GET /api/finance/summary?month=2026-05` returned revenue `10200000`, expense `1473456`, profit `8726544`, receipt count 3, and expense count 3 after the smoke expense; `/finance` renders dashboard cards and finance forms.
- [x] 28. Course pricing config - V1. Status: Verified. Verify: Admin created `Smoke Course Config 2026` through `POST /api/courses`, then `PATCH /api/courses/:id` updated total sessions to 9, price to 1900000, and set `isActive: false`; `/settings` renders the Course config UI.
- [ ] 29. Debt warning - Phase 2. Status: Todo. Verify: students with no remaining sessions and no new receipt are listed.
- [ ] 30. Refund management - Phase 2. Status: Todo. Verify: refunds reduce revenue and preserve reason.
- [x] 31. Sale revenue report - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned `saleRevenue` grouped by receipt creator with revenue and receipt count; `/reports` renders the Sale revenue panel.
- [x] 32. Automatic tuition reminder - Phase 2. Status: Verified. Verify: `GET /api/tuition-reminders?threshold=2&templateId=TUITION_LOW_SESSIONS` generated low-session reminder messages; `POST /api/tuition-reminders` queued task `cmp501u8g0007prh67aikt0d6` with the rendered message.

### Module 6 - Parent Portal

- [x] 33. View remaining sessions - Phase 2. Status: Verified. Verify: Parent-authenticated `GET /api/parent/portal` for `0911000001 / Parent@123` returned only child `Nguyễn Minh An` with `sessionsBought: 12`, `sessionsUsed: 4`, and `sessionsRemaining: 8`; `/parent` renders remaining session cards.
- [x] 34. Request absence online - Phase 2. Status: Verified. Verify: parent `POST /api/absence-requests` created request `cmp48z8bm0001prh6jl8nie83`; staff `GET /api/absence-requests?status=PENDING` returned it; staff `PATCH /api/absence-requests/:id` approved it and created `ABSENT_EXCUSED` attendance for the session.
- [x] 35. View photos and learning journal - Phase 2. Status: Verified. Verify: Parent portal API returned journal item `Seed attendance: bé An có mặt.` with attendance status and photo array; `/parent` renders journal/photo links for the selected child.
- [x] 36. Download final report - Phase 2. Status: Verified. Verify: Parent-authenticated `GET /api/parent/final-assessments/cmp3bby3s006tprux7w35pa67/download` returned HTTP 200 with `content-disposition: attachment` and report text for `Phạm Tường Vy`; staff-authenticated portal access remains forbidden. Feature 22 PDF formatting remains separate.
- [ ] 37. Schedule and notifications - Phase 2. Status: Todo. Verify: parent sees upcoming schedule and relevant notices.
- [x] 38. Parent feedback after course - Phase 2. Status: Verified. Verify: parent-authenticated `POST /api/parent/feedback` created feedback `cmp4qqfow0005prh6t5tr29pl` for `Phạm Tường Vy`; admin-authenticated `GET /api/course-feedback` returned it with `averageScore: 4.8`; parent portal returns the feedback and `/reports` summarizes feedback rows.

### Module 7 - Reports & Analytics

- [x] 39. Sale KPI - V1. Status: Verified. Verify: `GET /api/reports/sale-kpi?month=2026-05` returned Sale Kid Seeds KPI with lead count 3, converted count 2, conversion rate 66.7%, revenue 7200000, receipt count 2, and task counts; `/reports` renders the KPI page.
- [x] 40. Retention report - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned `retention` grouped by course with active enrollment count, renewed enrollment count, and retention rate; `/reports` renders the retention panel.
- [x] 41. Operations overview - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned `operations` with scheduled/completed classes, active/inactive students, present/absent counts, and absence rate; `/reports` renders the operations panel.
- [x] 42. Lead source analytics - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned source rows for Event, Website, Facebook Ads, Referral, Walk-in, and Zalo OA; `/reports` renders conversion by source.
- [x] 43. Revenue forecast - Phase 2. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned forecast with active enrollment count, low-session enrollment count, average remaining sessions, and projected renewal revenue; `/reports` renders the forecast panel.

### Module 8 - Operations & Settings

- [x] 44. User account management - V1. Status: Verified. Verify: Admin can list, create, edit, deactivate, and reset staff accounts through `/api/users` and `/settings`; Parent is blocked from user management with 403.
- [x] 45. Course configuration - V1. Status: Verified. Verify: Admin can create/edit/hide courses through the stable course API and `/settings` course configuration UI without deleting historical records.
- [x] 46. Activity log - Phase 2. Status: Verified. Verify: `POST /api/users` created `Audit Smoke Teacher` and wrote `user.create`; `POST /api/schedule-events` created `Smoke thông báo nội bộ` and wrote `schedule_event.create`; `GET /api/audit-logs?limit=5` returned actor, action, entity, summary, and timestamp; `/settings` renders the latest activity logs.
- [x] 47. Backup/export all data - V1 minimal, Phase 2 advanced. Status: Verified. Verify: Admin-authenticated `GET /api/exports/students-finance` downloaded a real `.xlsx`; `exceljs` verified sheets and row counts: Students 7, Receipts 4, Expenses 3. Export now includes student code columns for Students and Receipts.
- [x] 48. Excel import - Phase 2. Status: Verified. Verify: generated smoke `.xlsx` with columns `studentName,parentName,parentPhone,parentEmail,status,leadSource,healthNote`; `POST /api/imports/students` preview returned 1 valid row; commit created `Import Smoke Student` and wrote audit action `students.import`; `/settings` renders the Excel import panel.
- [x] 49. Internal notifications - Phase 2. Status: Verified. Verify: `POST /api/schedule-events` created `SCHEDULE_EVENT` internal notifications for Sale and Teacher users; `/dashboard` renders the internal notifications panel; `GET /api/notifications?limit=6` is available for staff users.
- [x] 50. Detailed permissions - V1 fixed roles, Phase 2 dynamic matrix. Status: Verified. Verify: V1 fixed role guards are implemented and smoke-tested for Admin, Sale, Teacher, and Parent; Phase 2 `PermissionMatrixEntry` persists role-permission rows, `PATCH /api/permission-matrix` updated `reports:view_own_kpi` to `ADMIN,SALE`, runtime `can()` reads the matrix override in-process, and `/settings` renders the permission matrix.

## V1 Acceptance Scope

- [x] CRM lead, pipeline, contact log, and task reminders work for Sale.
- [x] Student, parent, course, enrollment, and session balance are manageable.
- [x] Class schedule supports a compact tabbed "today's class" attendance view, a fullscreen-capable Notion-style month calendar generated from recurring class/course schedules, holiday/event blocks that move affected scheduled sessions, and one-click Vietnam holiday/event import for the selected year.
- [x] Attendance deducts sessions by business rule.
- [x] Weekly assessment works for FUN and Robotics.
- [x] Final assessment is blocked until required weekly checks are complete.
- [x] Receipt, expense, finance dashboard, and course pricing are available.
- [x] Sale KPI, user management, and student-parent-receipt Excel export are available.
- [x] Fixed RBAC protects Admin, Sale, Teacher, and Parent boundaries.

## Risk Notes

- Feature 12 "Groups/classes" must be V1 minimal because "today's class" cannot be reliable without class schedule data.
- Feature 47 mixes backup and export. V1 should implement manual Excel/JSON export; automated cloud backup belongs to Phase 2.
- Feature 50 should use fixed roles in V1. A dynamic permission matrix is higher risk and should wait until role behavior is stable.
- Weekly FUN/Robotics assessment is tracked as 24A/24B/24C so it remains traceable even though it is an add-on beyond the original 50 features.
- Parent Portal should not block V1 go-live unless the center requires parent self-service before internal operations.

## Phase Task Breakdown

### Phase 0 - Spec Lock

- [ ] P0.1 - Confirm V1 scope and phase boundaries. Feature IDs: all. Status: Todo. Verify: this document is accepted as the source of truth.
- [x] P0.2 - Lock roles and permission rules. Feature IDs: 50. Status: Verified. Verify: static permission map exists in `lib/permissions.ts`; dynamic `PermissionMatrixEntry` stores role overrides for every permission; `/api/permission-matrix` returns labels, defaults, and active roles.
- [x] P0.3 - Lock data model for students, classes, attendance, finance, and assessment. Feature IDs: 8, 9, 12, 14, 25, 24A, 24B, 24C. Status: Verified. Verify: `DATABASE_URL='postgresql://user:password@localhost:5432/kidseedshub' npx prisma validate` passed.
- [x] P0.4 - Lock FUN and Robotics rubrics. Feature IDs: 20, 23, 24A, 24B. Status: Verified. Verify: rubric data exists in `lib/assessment-rubrics.ts`, `/assessments` builds successfully, and `/api/assessment-rubrics` is available.

### Phase 1 - Foundation

- [x] P1.1 - Create Next.js app shell with TypeScript and dashboard layout. Feature IDs: foundation. Status: Verified. Verify: `npm run build`, `npm run typecheck`, and `npm run lint` passed.
- [x] P1.2 - Add Prisma/Postgres schema and seed data. Feature IDs: all V1 data. Status: Verified. Verify: `docker compose up -d postgres`, `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate dev --name init`, `npm run prisma:seed`, and DB count smoke check passed.
- [x] P1.3 - Add authentication and fixed RBAC. Feature IDs: 44, 50. Status: Verified. Verify: login form is wired to NextAuth credentials; Admin, Sale, Teacher, and Parent sessions/role boundaries were smoke-tested. Admin manages users; Sale can access pipeline but not finance summary; Teacher can access own class list but not pipeline; Parent is blocked from staff APIs.
- [x] P1.4 - Add shared validation and API response helpers. Feature IDs: all API features. Status: Verified. Verify: `lib/api-response.ts`, `lib/validations/assessment.ts`, and `/api/health` build successfully.

### Phase 2 - MVP Revenue Flow

- [x] P2.1 - Build lead/student CRUD and filters. Feature IDs: 1, 8. Status: Verified. Verify: lead create, student detail, and student profile edit are DB-verified; `/students` compact database view supports server pagination, search, status filter, sort direction, and hide/reorder fields; `/students` and `/pipeline` create lead panels store generated student code, gender, sale owner, class assignment, created-by, and timestamps through backend; new lead parent accounts stay inactive until the student is converted or active; student detail exposes a parent account tab with login guidance.
- [x] P2.2 - Build pipeline board and status updates. Feature IDs: 2. Status: Verified. Verify: five-stage status update API was smoke-tested through CRM stages; `/pipeline` supports drag/drop stage movement, explicit status select, compact paginated server-side database filters/sorts, filter-aware stage chips/full-width Kanban columns, draggable field visibility/order controls, and Nurture action for cold leads; moving a lead to `CONVERTED` or `ACTIVE` activates the parent account through shared backend logic.
- [x] P2.3 - Build contact logs and task reminders. Feature IDs: 3, 6. Status: Verified. Verify: contact log create/list and task create/done are DB-verified; pipeline quick dialog creates and refreshes latest contact logs and next tasks, while full student detail keeps the complete CRM tab.
- [x] P2.4 - Build dashboard alerts. Feature IDs: 4. Status: Verified. Verify: `GET /api/dashboard/alerts` returned seeded low-session, stale-trial, and due-task data.

### Phase 3 - Class Operations

- [x] P3.1 - Build course/class schedule basics. Feature IDs: 12, 45. Status: Verified. Verify: `GET /api/classes?active=true` returned active classes; `GET /api/classes/today` reflected generated sessions; `POST /api/classes` created `Smoke Recurring Course Schedule` with T7/CN slots and generated 6 sessions; `PATCH /api/class-sessions/:id` moved one generated session to `2026-05-18` and marked it `CANCELED`; `PATCH /api/classes/:id/students` assigned `Smoke FUN Assessment` and `Trần Bảo Ngọc` to the class roster.
- [x] P3.2 - Build one-tap attendance. Feature IDs: 14. Status: Verified. Verify: `POST /api/attendance` marked `PRESENT` for the smoke enrollment and returned the updated attendance.
- [x] P3.3 - Add automatic session deduction. Feature IDs: 9, 15. Status: Verified. Verify: first `PRESENT` consumed one session; repeated same-day `PRESENT` did not double-charge.
- [x] P3.4 - Add lesson notes and class photos. Feature IDs: 11, 16, 17. Status: Verified. Verify: attendance note and class photo URL were saved by API; today's class returned note/photo count; student detail returned the photo album item.
- [x] P3.5 - Add holiday/event schedule blocking. Feature IDs: 12. Status: Verified. Verify: `POST /api/schedule-events` created `Smoke nghỉ lễ dời lịch` for `2026-05-24` with `affectsScheduling: true` and returned `movedSessions: 1`; direct DB check confirmed the affected `Smoke Recurring Course Schedule` session moved from the blocked holiday date to `2026-06-06`; `/classes` includes a fullscreen calendar toggle, holiday/event management form, and `POST /api/schedule-events/vietnam-holidays` import. `tsx` verified the 2026 preset contains 29 items: 22 scheduling holidays that can move classes and 7 non-moving center events including Trung thu, 1/6, khai giảng, and 20/11. Earlier Playwright smoke verified the old import button flow; latest browser smoke was blocked because Docker/Postgres was not running.

### Phase 4 - Weekly Assessment

- [x] P4.1 - Add FUN rubric and weekly checklist. Feature IDs: 23, 24A. Status: Verified. Verify: FUN weekly API smoke created `Smoke FUN Assessment` week 1 COMPLETE with 30/30 checked outcomes.
- [x] P4.2 - Add Robotics weekly scoring. Feature IDs: 20, 23, 24B. Status: Verified. Verify: Robotics weekly API/UI now save `score` 1-5 per skill, reject out-of-range scores via validation/schema constraint, preserve old `progressLevel` records through fallback mapping, and Playwright smoke saved/reloaded class assessment through `/api/weekly-assessments/classroom`.
- [x] P4.3 - Add assessment status indicators. Feature IDs: 24A, 24B. Status: Verified. Verify: weekly assessment list returns `COMPLETE`, checked item counts, total item counts, subject, teacher, and updated timestamp for FUN and Robotics.

### Phase 5 - Final Assessment

- [x] P5.1 - Add final assessment gate. Feature IDs: 24C. Status: Verified. Verify: `POST /api/final-assessments` returned HTTP 409 when weekly COMPLETE count was below `requiredWeeks`, and returned success when the gate was satisfied.
- [x] P5.2 - Add final assessment summary form. Feature IDs: 24C. Status: Verified. Verify: final assessment API saved strengths, improvements, teacher summary, and next steps for FUN and Robotics; response now uses a safe DTO without raw teacher credentials. Feature 22 PDF export remains out of this task.
- [x] P5.3 - Add student assessment history. Feature IDs: 10, 21. Status: Verified. Verify: `npm run typecheck`, `npm run lint`, and `npm run build` passed; Playwright verified Admin login, `/students/cmp3bby2o000vpruxbibpq6fm`, tab `Học tập`, `Tiến độ đánh giá`, and `Timeline học tập`.
- [x] P5.4 - Dynamic rubric, class weekly workflow, and published final PDF. Feature IDs: 22, 23, 24A, 24B, 24C. Status: Verified. Verify: `DATABASE_URL='postgresql://kidseedshub:kidseedshub@localhost:5434/kidseedshub' npx prisma migrate status` reports up to date after applying `20260524152000_dynamic_rubrics_final_reports`; `npm run prisma:seed`, `npm run typecheck`, `npm run lint`, and `npm run build` passed. Robotics final report now aggregates average score per skill from completed weekly assessments, renders radar chart + 8-skill table on `/final-assessments/:id/print`, and keeps parent visibility behind the existing `PUBLISHED` rule.

### Phase 6 - Finance & Export

- [x] P6.1 - Build course pricing config. Feature IDs: 28, 45. Status: Verified. Verify: `POST /api/courses` created `Smoke Course Config 2026`; `PATCH /api/courses/:id` changed total sessions, price, and active state; `/settings` renders the Course config section.
- [x] P6.2 - Build tuition receipts. Feature IDs: 25. Status: Verified. Verify: `POST /api/receipts` created receipt `PT-2026-004` and incremented enrollment sessions from 0 to 12. Mid-course receipt redesign verified with Playwright on `/students/cmp3bby2o000vpruxbibpq6fm`: entered free trial `2`, billable sessions `10`, paid-before-receipt `3`, cash discount `100000`, discount `10%`; UI computed `2,150,000đ`, backend created `PT-2026-006`, student remaining sessions became `8`, and `/receipts/cmp707t580001prq7vdhj5j99/print` rendered print/PDF details. Compact finance UI now labels enrollments as `Khóa đã đăng ký`, supports one receipt with multiple `ReceiptLine` rows, flexible discount input (`10%` or money), one shared `Ghi chú phiếu thu`, formatted money input, and browser print for multi-course receipts; Playwright verified `PT-2026-007` single-line `10%` receipt and `PT-2026-008` Robotics + FUN receipt. Finance guardrail update added non-negative session constraints, confirmation dialogs before manual billable-session/payment-total overrides, and `PATCH /api/enrollments/:id` plus a `Sửa khóa đã đăng ký` dialog for class/start/join/session edits. Registered-course mistake handling is now verified: `DELETE /api/enrollments/:id` hard-deletes only enrollments without receipts/attendance/assessments, otherwise marks them inactive and keeps history; Student Detail exposes this as `Xóa/Hủy ghi danh` with a confirmation dialog. Student Finance now shows all historical receipts in a compact scroll-contained `Lịch sử phiếu thu` panel; Playwright verified `/students/cmp6ekscy0004pr90eps4b5z6` shows six receipts including course, monthly, and three-course cases.
- [x] P6.3 - Build expenses and finance dashboard. Feature IDs: 26, 27. Status: Verified. Verify: `POST /api/expenses` created `PC-2026-003`; `GET /api/expenses?month=2026-05` returned it; `GET /api/finance/summary?month=2026-05` returned expected revenue, expense, profit, and grouped counts.
- [x] P6.4 - Build Excel/JSON export. Feature IDs: 47. Status: Verified. Verify: Admin-authenticated Excel download succeeded; workbook opened with `exceljs` and contains Students, Receipts, and Expenses sheets.

### Phase 7 - Reports & Parent Portal

- [x] P7.1 - Build Sale KPI. Feature IDs: 39. Status: Verified. Verify: Admin can view all Sale KPI rows, Sale can view only own KPI row, and Sale remains forbidden from admin-only finance summary.
- [x] P7.2 - Build Parent Portal basics. Feature IDs: 33, 35, 36. Status: Verified. Verify: `/api/parent/portal` is guarded by `portal:view_child`, returns only the logged-in parent's children, course balances, upcoming sessions, journal/photos, and final assessments; `/parent` renders the portal; report download endpoint verifies parent ownership before returning an attachment.
- [x] P7.3 - Build absence request flow. Feature IDs: 34, 18. Status: Verified. Verify: parent request creates staff review item; approval creates `ABSENT_EXCUSED` attendance for the matching student/session; staff can assign a makeup date from the `Học bù` tab and the date persists on the attendance record.
- [x] P7.4 - Build feedback after course. Feature IDs: 38. Status: Verified. Verify: parent can submit feedback from final report cards; admin can view feedback in Reports; API smoke confirmed created feedback and admin visibility.

### Phase 8 - Automation & Scale

- [x] P8.1 - Build Zalo templates and tuition reminders. Feature IDs: 7, 32. Status: Verified. Verify: approved Zalo templates are exposed by API, low-session tuition reminders generate personalized messages, and reminders can be queued as tasks from `/finance`.
- [x] P8.2 - Build advanced analytics. Feature IDs: 5, 31, 40, 41, 42, 43. Status: Verified. Verify: `GET /api/reports/advanced?month=2026-05` returned lead source, Sale revenue, retention, operations, and forecast sections; `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- [x] P8.3 - Build audit log and internal notifications. Feature IDs: 46, 49. Status: Verified. Verify: `npm run typecheck`, `npm run lint`, and `npm run build` passed; DB smoke showed `schedule_event.create` and `user.create` audit rows plus `SCHEDULE_EVENT` notifications for staff; Playwright confirmed Dashboard renders `Thông báo nội bộ` and Settings renders `Log hoạt động`.
- [x] P8.4 - Build import, dynamic permissions, and QR attendance. Feature IDs: 19, 48, 50. Status: Verified. Verify: `npm run typecheck`, `npm run lint`, and `npm run build` passed; QR smoke marked attendance; Excel preview/commit created one student; permission matrix PATCH persisted and returned updated roles; Playwright confirmed QR, import, and permission matrix UI render.
