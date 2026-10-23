/**
 * English strings. This object is the source of truth for the message key set:
 * `Messages` is derived from it and `ar.ts` must satisfy it. Keys are flat
 * dotted strings; `{var}` placeholders are filled by `t(key, vars)`.
 */

export const messages = {
  // Browser-tab metadata
  "meta.title": "School Bus Transit",
  "meta.description": "School bus attendance and transit monitoring",
  "meta.mobileTitle": "Bus #04 • Morning Run",
  "meta.mobileDescription": "School bus attendance roster",
  "meta.dashboardTitle": "School Transit Live Monitor",
  "meta.dashboardDescription": "Real-time school transit monitoring dashboard",

  // Login screen
  "login.heading": "School Bus Transit",
  "login.subtitle": "Attendance and route monitoring for school transport.",
  "login.driverTab": "Driver code",
  "login.directorTab": "Director",
  "login.modeAria": "Choose sign-in mode",
  "login.code": "Access code",
  "login.codePlaceholder": "000000",
  "login.codeError": "That code isn't valid. Check it and try again.",
  "login.codeLocked": "Too many attempts. Try again in {minutes} minutes.",
  "login.driverHint": "Ask your school director for your 6-digit access code.",
  "login.email": "Email",
  "login.password": "Password",
  "login.emailPlaceholder": "you@school.edu",
  "login.passwordPlaceholder": "••••••••",
  "login.showPassword": "Show password",
  "login.hidePassword": "Hide password",
  "login.signIn": "Sign in",
  "login.fallbackError": "Sign in failed. Check your email and password.",
  "login.notDirector":
    "That email belongs to a driver account. Drivers sign in with their access code on the Driver code tab.",
  "login.tooManyAttempts":
    "Too many sign-in attempts. Wait a few minutes and try again.",
  "login.notConfiguredTitle": "Firebase not configured",
  "login.notConfiguredBody":
    "Fill the keys in {code} to enable sign-in. The app is running on mock data.",
  "login.backToApp": "Back to the app",

  // Mobile roster screen
  "mobile.loading": "Loading roster…",
  "mobile.appBarTitle": "Bus {bus}",
  "mobile.appBarTitleNoBus": "Morning run",
  "mobile.runTitle": "Morning run",
  "mobile.runDate": "{date}",
  "mobile.runInProgress": "In progress",
  "mobile.runCompleted": "Run completed",
  "mobile.runNotStarted": "No run dispatched",
  "mobile.moreOptionsAria": "More options",
  "mobile.moreOptionsForAria": "More options for {name}",
  "mobile.searchAria": "Search students",
  "mobile.searchPlaceholder": "Search student",
  "mobile.clearSearchAria": "Clear search",
  "mobile.emptyTitle": "No students found",
  "mobile.emptySubtitle": "Try a different name or filter.",
  "mobile.noRunTitle": "No run today",
  "mobile.noRunBody":
    "Your director hasn't dispatched this bus's morning run yet. It will appear here when they do.",
  "mobile.syncStatus": "Sync status",
  "mobile.online": "Live",
  "mobile.offline": "Offline — changes saved",
  "mobile.offlineHint":
    "You're offline. Status taps are queued and will sync when the signal returns.",
  "mobile.summaryOnboard": "On board",
  "mobile.summaryDropped": "Dropped",
  "mobile.summaryWaiting": "Waiting",
  "mobile.summaryAbsent": "Absent",
  "mobile.summaryAria": "Run totals",
  "mobile.statusHint": "Tap the status to update it",
  "mobile.completeRun": "Complete run",
  "mobile.completing": "Completing…",
  "mobile.completed": "Run completed",
  "mobile.signInPromptTitle": "Sign in to see the live roster",
  "mobile.signInPromptBody":
    "The roster loads from your school's live data after you sign in.",
  "mobile.signInAction": "Sign in",
  "mobile.noBusTitle": "No bus assigned",
  "mobile.noBusBody":
    "Your account isn't linked to a bus yet. Ask your school director to assign you one.",

  // Roster filter tabs
  "tabs.filterAria": "Filter students by status",
  "tabs.all": "All",
  "tabs.waiting": "Waiting",
  "tabs.boarded": "Boarded",
  "tabs.done": "Done",

  // Attendance statuses (shared mobile pills/chips + dashboard badges)
  "status.boarded": "Boarded",
  "status.waiting": "Waiting",
  "status.droppedOff": "Dropped Off",
  "status.absent": "Absent",

  // Route guard
  "guard.checking": "Checking access…",

  // Translatable prefixes embedded in data labels (e.g. "Bus 04", "Grade 4B")
  "bus.bus": "Bus",
  "bus.grade": "Grade",

  // Run-type labels
  "runType.morningPickup": "Morning Pickup",
  "runType.afternoonDropoff": "Afternoon Drop-off",

  // Dashboard sidebar nav
  "nav.liveMap": "Live monitor",
  "nav.fleet": "Fleet status",
  "nav.routes": "Routes",
  "nav.reports": "Reports",
  "nav.assignments": "Assignments",
  "nav.drivers": "Drivers",
  "nav.dispatch": "Dispatch vehicle",
  "nav.primaryAria": "Primary navigation",
  "nav.operate": "Operate",
  // Short labels for the phone bottom bar (4 destinations).
  "nav.shortLive": "Live",
  "nav.shortReports": "Reports",
  "nav.shortAssignments": "Assign",
  "nav.shortDrivers": "Drivers",
  "nav.manage": "Manage",

  // Dashboard screen
  "dashboard.title": "Live monitor",
  "dashboard.loading": "Loading live data…",
  "dashboard.activeFleet": "Routes",
  "dashboard.enRouteOne": "{count} bus en route",
  "dashboard.enRouteMany": "{count} buses en route",
  "dashboard.enRouteOf": "{active} of {total} en route",
  "dashboard.liveAttendance": "Student roster",
  "dashboard.liveUpdating": "Live",
  "dashboard.caption": "Live student attendance",
  "dashboard.th.studentName": "Student",
  "dashboard.th.grade": "Grade",
  "dashboard.th.bus": "Bus",
  "dashboard.th.morningBoarded": "Boarded at",
  "dashboard.th.dropOffTime": "Dropped at",
  "dashboard.th.currentStatus": "Status",
  "dashboard.th.waiting": "Waiting",
  "dashboard.th.actions": "History",
  "dashboard.th.assigned": "Assigned",
  "dashboard.th.completion": "Completion",
  "dashboard.emptyTitle": "No students match these filters",
  "dashboard.emptySubtitle": "Clear the search or pick another status.",
  "dashboard.callAria": "Call {name}",
  "dashboard.historyAria": "View history for {name}",
  "dashboard.driver": "Driver: {name}",
  "dashboard.noDriver": "No driver assigned",
  "dashboard.inProgress": "In progress",
  "dashboard.completed": "Completed",
  "dashboard.routeProgress": "Route progress",
  "dashboard.routeComplete": "{percent}% complete",
  "dashboard.in": "On board",
  "dashboard.out": "Dropped",
  "dashboard.wait": "Waiting",
  "dashboard.today": "Today",
  "dashboard.runTypeAria": "Run type",
  "dashboard.export": "Export CSV",
  "dashboard.selectDate": "Select a date",
  "dashboard.prevMonth": "Previous month",
  "dashboard.nextMonth": "Next month",
  "dashboard.liveUnavailable": "Live data unavailable — sign in to continue.",
  "dashboard.notificationsAria": "Notifications",
  "dashboard.helpAria": "Help",
  "dashboard.settingsAria": "Settings",
  "dashboard.noContactNumber": "No contact number on file",
  "dashboard.openNavAria": "Open navigation menu",
  "dashboard.closeNavAria": "Close navigation menu",

  // The screen's answer, in one line under the title
  "dashboard.accountedLabel": "Accounted for",
  "dashboard.accounted": "{accounted} of {total} accounted for",
  "dashboard.summary.open": "{count} still to account for",
  "dashboard.summary.breakdown": "{onboard} on board · {dropped} dropped · {open} open",
  "dashboard.finding.empty": "No attendance has been recorded for this run yet.",
  "dashboard.noRoutes": "No routes have been dispatched for this run.",
  "dashboard.finding.allClear": "All {total} students are accounted for.",
  "dashboard.finding.open": "Still to account for: {count} of {total} students.",
  "dashboard.finding.completedWithWaiting":
    "{bus} was signed off with {count} still waiting.",
  "dashboard.scope": "{school} · {date} · {segment}",
  "dashboard.addRun": "Dispatch vehicle",

  // Student list (dashboard) — search, filters, and pagination
  "studentList.searchAria": "Search students",
  "studentList.searchPlaceholder": "Search student name…",
  "studentList.statusAria": "Filter by status",
  "studentList.gradeAria": "Filter by grade",
  "studentList.allGrades": "All grades",
  "studentList.clear": "Clear filters",
  "studentList.showing": "Showing {start}–{end} of {total}",
  "studentList.previousAria": "Previous page",
  "studentList.nextAria": "Next page",
  "studentList.pageAria": "Page {page} of {pages}",

  // KPI cells — labels are nouns, footers are computed captions
  "kpi.total.label": "Assigned",
  "kpi.total.footer": "Across {count} routes",
  "kpi.onboard.label": "On board",
  "kpi.onboard.footer": "{percent}% of assigned",
  "kpi.dropped.label": "Dropped off",
  "kpi.dropped.footer": "{percent}% of assigned",
  "kpi.absent.label": "Unaccounted",
  "kpi.absent.footer": "{waiting} waiting · {absent} absent",

  // Roles
  "role.director": "Director",
  "role.staff": "Staff",

  // Shared dialogs
  "dialog.close": "Close",
  "dialog.cancel": "Cancel",
  "dialog.confirm": "Confirm",

  // Run details (mobile overflow sheet)
  "runDetails.title": "Run Details",
  "runDetails.bus": "Bus",
  "runDetails.type": "Run Type",
  "runDetails.date": "Date",
  "runDetails.status": "Status",
  "runDetails.noRun": "No run started yet",

  // Student attendance history
  "history.title": "Attendance History",
  "history.loading": "Loading history…",
  "history.empty": "No attendance history for this student",
  "history.loadMore": "Load more",
  "history.col.date": "Date",
  "history.col.run": "Run",
  "history.col.status": "Status",
  "history.col.bus": "Bus",

  // Confirm dialogs
  "confirm.completeRun.title": "Complete this run?",
  "confirm.completeRun.body":
    "Waiting students will be marked absent. This can't be undone.",
  "confirm.signOut.title": "Sign out?",
  "confirm.signOut.body": "You'll be returned to the login screen.",

  // Dispatch vehicle
  "dispatch.title": "Dispatch Vehicle",
  "dispatch.bus": "Bus",
  "dispatch.runType": "Run Type",
  "dispatch.date": "Date",
  "dispatch.selectBus": "Select a bus",
  "dispatch.submit": "Dispatch",
  "dispatch.loadError": "Couldn't load the bus list.",

  // Student kebab menu
  "kebab.viewHistory": "View history",
  "kebab.markAbsent": "Mark absent",

  // Settings drawer
  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.email": "Email",
  "settings.role": "Role",
  "settings.appearance": "Appearance",
  "settings.language": "Language",
  "settings.signOut": "Sign out",

  // Help dialog
  "help.title": "Help",
  "help.content":
    "The dashboard shows live bus status, KPIs, and the student attendance roster.\nUse the run-type control to switch Morning Pickup / Afternoon Drop-off.\nSet a date to view a past day.\nDispatch creates a new run and pre-registers waiting students.\nExport downloads the current filtered rows as CSV.",

  // Toasts
  "toast.exported": "Exported {count} rows",
  "toast.dispatched": "Vehicle dispatched",
  "toast.runCompleted": "Run completed",
  "toast.signedOut": "Signed out",
  "toast.markedAbsent": "{name} marked absent",
  "toast.dispatchExists": "A run already exists for this bus, date and type",
  "toast.error": "Something went wrong. Please try again.",

  // Analytics (modal opened from Reports)
  "analytics.title": "Attendance Analytics",
  "analytics.perBus": "Per-Bus Comparison",
  "analytics.trendTitle": "Multi-day Trend",
  "analytics.trendHint": "Daily totals across a date range",
  "analytics.startDate": "Start date",
  "analytics.endDate": "End date",
  "analytics.trendLoading": "Loading trend…",
  "analytics.trendEmpty": "No attendance data in this range",
  "analytics.rangeTooLong": "The date range is too long — maximum 31 days",
  "analytics.rangeInvalid": "Start date must be before end date",
  "analytics.emptyTitle": "No attendance data",
  "analytics.emptySubtitle": "No records exist for this date and run segment yet.",

  // Reports
  "reports.title": "Attendance Report",
  "reports.subtitle": "Printable attendance summary for the selected day and run segment",
  "reports.analytics": "Analytics",
  "reports.overview": "Overview",
  "reports.byBus": "Summary by Bus",
  "reports.byGrade": "Summary by Grade",
  "reports.roster": "Attendance Roster",
  "reports.print": "Print",
  "reports.export": "Export CSV",
  "reports.emptyTitle": "No attendance data",
  "reports.emptySubtitle": "No records exist for this date and run segment yet.",

  // Assignments (director — driver ↔ bus, student ↔ bus)
  "assignments.title": "Assignments",
  "assignments.subtitle": "Assign drivers and students to buses",
  "assignments.busesEmpty": "No buses have been set up yet.",
  "assignments.drivers": "Drivers",
  "assignments.th.bus": "Bus",
  "assignments.th.driver": "Assigned Driver",
  "assignments.th.assignedStudents": "Assigned Students",
  "assignments.unassigned": "—",
  "assignments.students": "Students",
  "assignments.th.studentName": "Student Name",
  "assignments.th.grade": "Grade",
  "assignments.th.currentBus": "Current Bus",
  "assignments.noBus": "No bus",
  "assignments.studentsEmpty": "No students found",
  "assignments.studentsEmptyHint": "Adjust your search or load more students.",
  "assignments.loadingStudents": "Loading students…",
  "assignments.loadMore": "Load more",
  "assignments.driverAssigned": "Driver assigned",
  "assignments.driverCleared": "Driver unassigned",
  "assignments.studentMoved": "Student bus updated",

  // Drivers (director — driver accounts + access codes)
  "drivers.title": "Drivers",
  "drivers.subtitle": "Create driver accounts and manage access codes",
  "drivers.addTitle": "Add driver",
  "drivers.nameLabel": "Driver name",
  "drivers.namePlaceholder": "e.g. Rita Patel",
  "drivers.create": "Create & generate code",
  "drivers.accessCodes": "Access codes",
  "drivers.th.name": "Driver",
  "drivers.th.bus": "Bus",
  "drivers.th.code": "Access Code",
  "drivers.noBus": "Not assigned",
  "drivers.generateCode": "Generate code",
  "drivers.revealAria": "Show code for {name}",
  "drivers.hideAria": "Hide code for {name}",
  "drivers.copyAria": "Copy code for {name}",
  "drivers.regenerateAria": "Regenerate code for {name}",
  "drivers.regenerateConfirmTitle": "Regenerate code?",
  "drivers.regenerateConfirmBody":
    "This gives {name} a new code. The old code will stop working.",
  "drivers.empty": "No drivers yet",
  "drivers.emptyHint": "Add a driver to generate their access code.",
  "drivers.newCodeTitle": "Driver created",
  "drivers.newCodeBody": "Access code for {name}:",
  "drivers.copied": "Code copied",
  "drivers.copyError": "Couldn't copy the code",
  "drivers.createdToast": "Driver account created",
  "drivers.regeneratedToast": "Access code updated",
  "drivers.createError": "Couldn't create the driver. Please try again.",

  // Common
  "common.changeLanguageAria": "Change language",

  // Appearance (dark mode)
  "theme.aria": "Appearance",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.toggleToDark": "Switch to dark theme",
  "theme.toggleToLight": "Switch to light theme",
  "common.loading": "Loading",
};

/** Key set is the object's keys; every value is a plain string. */
export type Messages = Record<keyof typeof messages, string>;
