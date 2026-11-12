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
  "login.directorTab": "Director or operator",
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
  "mobile.writeFailed": "That change was not saved. If this keeps happening, tell the school office.",
  "mobile.offlineHint":
    "You're offline. Status taps are queued and will sync when the signal returns.",
  "mobile.summaryOnboard": "On board",
  "mobile.summaryDropped": "Dropped",
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
  "tabs.boarded": "Boarded",
  "tabs.done": "Done",

  // Attendance statuses (shared mobile pills/chips + dashboard badges)
  "status.boarded": "Boarded",
  "status.waiting": "Unaccounted",
  "status.droppedOff": "Dropped Off",
  "status.absent": "Absent",

  // Route guard
  "guard.checking": "Checking access…",

  // Translatable prefixes embedded in data labels (e.g. "Bus 04", "Class 4B")
  "bus.bus": "Bus",
  "bus.grade": "Class",

  // Run-type labels
  "runType.morningPickup": "Morning Pickup",
  "runType.afternoonDropoff": "Afternoon Drop-off",

  // Dashboard sidebar nav
  "nav.liveMap": "Live monitor",
  "nav.fleet": "Fleet status",
  "nav.routes": "Routes",
  "nav.students": "Students",
  "mobile.markBoarded": "Board",
  "nav.reports": "Reports",
  "nav.assignments": "Assignments",
  "nav.drivers": "Drivers",
  "nav.operators": "Operators",
  "nav.dispatch": "Dispatch vehicle",
  "nav.primaryAria": "Primary navigation",
  "nav.operate": "Operate",
  // Short labels for the phone bottom bar (4 destinations).
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
  "dashboard.th.studentName": "Student",
  "dashboard.th.grade": "Class",
  "dashboard.th.bus": "Bus",
  "dashboard.th.morningBoarded": "Boarded at",
  "dashboard.th.dropOffTime": "Dropped at",
  "dashboard.th.currentStatus": "Status",
  "dashboard.th.waiting": "Unaccounted",
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
  "dashboard.routeProgress": "Run progress",
  "dashboard.routeComplete": "{percent}% complete",
  "dashboard.in": "On board",
  "dashboard.out": "Dropped",
  "dashboard.today": "Today",
  "dashboard.runTypeAria": "Run type",
  "dashboard.export": "Export CSV",
  "dashboard.selectDate": "Select a date",
  "dashboard.prevMonth": "Previous month",
  "dashboard.nextMonth": "Next month",
  "datePicker.clear": "Clear",
  "datePicker.chooseDay": "Choose a day",
  "datePicker.selected": "Selected {date}",
  "datePicker.calendar": "{label} calendar",
  "datePicker.todayWithDate": "Today, {date}",
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
  "dashboard.finding.allClear.one": "{total} student is accounted for.",
  "dashboard.finding.open": "Still to account for: {count} of {total} students.",
  "dashboard.finding.open.one": "Still to account for: {count} of {total} student.",
  "dashboard.finding.completedWithWaiting":
    "{bus} was signed off with {count} students still unrecorded.",
  "dashboard.finding.completedWithWaiting.one":
    "{bus} was signed off with {count} student still unrecorded.",
  "dashboard.scope": "{school} · {date} · {segment}",
  "dashboard.addRun": "Dispatch vehicle",

  // Bus overview (a fleet row opened)
  "fleet.title": "{bus} overview",
  "fleet.titleNoBus": "Bus overview",
  "fleet.openAria": "Open overview for {bus}",
  "fleet.sectionOnboard": "On board",
  "fleet.sectionDropped": "Dropped off",
  "fleet.sectionAbsent": "Absent",
  "fleet.absentHint": "Absent for this run",
  "fleet.emptyTitle": "No students on this run",
  "fleet.emptyBody": "No attendance has been recorded on this bus for this run yet.",
  "fleet.searchAria": "Search students on this bus",
  "fleet.searchPlaceholder": "Search students",
  "fleet.searchMatches": "{shown} of {total} students",
  "fleet.searchEmptyTitle": "No students match this search",
  "fleet.searchEmptyBody": "Try another name, or clear the search.",

  // Student list (dashboard) — search, filters, and pagination
  "studentList.searchAria": "Search students",
  "studentList.searchPlaceholder": "Search student name…",
  "studentList.gradeAria": "Filter by class",
  "studentList.allGrades": "All classes",
  "studentList.clear": "Clear filters",
  // Inside a dropdown menu whose list is long enough to scan for a value.
  "dropdown.searchPlaceholder": "Search…",
  "dropdown.searchEmpty": "No matches",
  "pagination.showing": "Showing {start}–{end} of {total}",
  "studentList.previousAria": "Previous page",
  "studentList.nextAria": "Next page",
  "pagination.navAria": "Pagination",
  "pagination.previous": "Previous page",
  "pagination.next": "Next page",
  "pagination.pageNumber": "Page {page}",

  // KPI cells — labels are nouns, footers are computed captions
  "kpi.total.label": "Assigned",
  "kpi.total.footer": "Across {count} routes",
  "kpi.total.footer.one": "Across {count} route",
  "kpi.onboard.label": "On board",
  "kpi.onboard.footer": "{percent}% of assigned",
  "kpi.dropped.label": "Dropped off",
  "kpi.dropped.footer": "{percent}% of assigned",
  "kpi.absent.label": "Unaccounted",
  "kpi.absent.footer": "{absent} absent · {unrecorded} with no record",

  // Roles
  "role.director": "Director",
  "role.operator": "Operator",
  "role.mainDirector": "Main director",
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
  "history.col.date": "Date",
  "history.col.run": "Run",
  "history.col.status": "Status",
  "history.col.bus": "Bus",

  // Confirm dialogs
  "confirm.completeRun.title": "Complete this run?",
  "confirm.completeRun.body":
    "Students with no record will be marked absent. This can't be undone.",
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
    "The dashboard shows live bus status, the runs and the day\u2019s totals.\nUse the run-type control to switch Morning Pickup / Afternoon Drop-off.\nSet a date to view a past day.\nDispatch creates a new run and pre-registers the students on it.\nStudents holds the school roll and each child\u2019s history.\nExport downloads the current filtered rows as CSV.",

  // Guidebook — the manual behind the tour. One page per screen, filtered by
  // what the reader can open (see src/lib/guide.ts).
  "guide.title": "Guidebook",
  "help.openGuide": "Open the guidebook",
  "guide.lead": "How each screen works, one page at a time.",
  "guide.contents": "Pages",
  "guide.searchAria": "Search the guidebook",
  "guide.searchPlaceholder": "Search the guidebook",
  "guide.searchEmpty": "No page mentions \u201c{term}\u201d.",
  "guide.lockedLabel": "Not yours to open",
  "guide.lockedHint":
    "A director can grant a screen on the Operators page. The manual explains it either way.",
  "guide.lockedTitle": "Not yours to open",
  "guide.lockedBody":
    "Your account opens this page only after a director grants it. What follows is what the page does.",
  "guide.stepsHeading": "How it works",
  "guide.wordsHeading": "Words on this screen",
  "guide.replayTour": "Show me around",
  "guide.previous": "Previous",
  "guide.next": "Next",
  "guide.pickerLabel": "Page",

  // Guidebook — one section per screen. Titles reuse the nav keys.
  "guide.live.tldr":
    "The day's answer: who is on the bus, who is off it, and who nobody has recorded yet.",
  "guide.live.caption":
    "The accounted-for block, one route row, and the counts behind them.",
  "guide.live.s1.title": "Start with the day's answer",
  "guide.live.s1.body":
    "Accounted for is one figure: children with a recorded state, over the children assigned to this run.",
  "guide.live.s2.title": "Open a route",
  "guide.live.s2.body":
    "A route row opens that bus's sheet, with every child on it in the order they came off.",
  "guide.live.s3.title": "Read the runs still moving",
  "guide.live.s3.body":
    "A run closes when the driver completes it. A closed run that still has children unrecorded is the one that needs a call.",
  "guide.live.w1.meaning":
    "The children with a recorded state, out of those assigned to the run.",
  "guide.live.w2.meaning":
    "Morning pickup and afternoon drop-off are two runs with two rosters; the day is both together.",

  "guide.students.tldr": "The whole school roll, and one child's history when you need it.",
  "guide.students.caption":
    "Every child in the school, with their presence over the last 90 days.",
  "guide.students.s1.title": "Narrow the roll",
  "guide.students.s1.body":
    "Search a name, filter by class, and sort by name or class. The line above the table says how many students you are looking at.",
  "guide.students.s2.title": "One row per child",
  "guide.students.s2.body":
    "Present days, absent days, attendance and the last recorded day, over the days the school still keeps.",
  "guide.students.s3.title": "Open a child's history",
  "guide.students.s3.body":
    "One row per run, newest first, for the days the school still keeps.",
  "guide.students.w1.term": "The roll",
  "guide.students.w1.meaning": "Every child in the school, whatever happened today.",
  "guide.students.w2.term": "Attendance",
  "guide.students.w2.meaning":
    "Present days out of the days that have a record, over the last 90 days.",

  "guide.reports.tldr": "The same day, counted by class instead of by bus.",
  "guide.reports.caption":
    "The day and run at the top, one class card, and the way into Analytics.",
  "guide.reports.s1.title": "Set the day and the run",
  "guide.reports.s1.body":
    "Reports keeps its own date; changing it here never moves the Live monitor or Students.",
  "guide.reports.s2.title": "Read the class cards",
  "guide.reports.s2.body":
    "Each card is one class that day: present, absent and the attendance rate.",
  "guide.reports.s3.title": "Compare the buses",
  "guide.reports.s3.body":
    "Analytics draws completed trips per bus as bars or as a ring: two designs for the same numbers.",
  "guide.reports.w1.term": "Attendance rate",
  "guide.reports.w1.meaning":
    "Present days out of the days recorded in the window, never out of the calendar.",
  "guide.reports.w2.term": "Completed trip",
  "guide.reports.w2.meaning": "A run the driver finished. Only completed runs are compared.",

  "guide.assignments.tldr":
    "Which bus each child rides: one at a time, or a whole sheet at once.",
  "guide.assignments.caption":
    "The filters, one student's bus selector, and the sheet import.",
  "guide.assignments.s1.title": "Narrow the list first",
  "guide.assignments.s1.body":
    "Search by name, or filter by bus and class. The line above the table says how many students you are looking at.",
  "guide.assignments.s2.title": "Move one child",
  "guide.assignments.s2.body":
    "The bus selector saves the moment you choose, and the row shows the new bus without waiting for a re-read.",
  "guide.assignments.s3.title": "Move a whole sheet",
  "guide.assignments.s3.body":
    "Drop a CSV or XLSX, check the column matching and the preview, then apply. Unmatched rows are reported, never dropped.",
  "guide.assignments.import": "Import a sheet",
  "guide.assignments.w1.term": "Assignment mode",
  "guide.assignments.w1.meaning":
    "Whether the column is labelled by bus or by driver. It is the school's setting, so colleagues read the same answer.",
  "guide.assignments.w2.term": "Unmatched row",
  "guide.assignments.w2.meaning":
    "A line the import could not place against a student. Nothing is written for it.",

  "guide.drivers.tldr": "Driver accounts and the six-digit codes they sign in with.",
  "guide.drivers.caption":
    "A driver row: the account, the code, and the moment it is shown.",
  "guide.drivers.s1.title": "Create the driver",
  "guide.drivers.s1.body":
    "A name is enough. The API creates the account, and the first code is issued with it.",
  "guide.drivers.s2.title": "Copy the code now",
  "guide.drivers.s2.body":
    "Codes are stored hashed. The plaintext shows once, in the row, and leaving the page loses it.",
  "guide.drivers.s3.title": "Regenerate when it is shared",
  "guide.drivers.s3.body":
    "A new code replaces the old one at once, and the old code stops working.",
  "guide.drivers.w1.term": "Access code",
  "guide.drivers.w1.meaning": "Six digits a driver types instead of an email and password.",
  "guide.drivers.w2.meaning":
    "Issues a new code that replaces the old one at once and cannot be looked up later.",

  "guide.operators.tldr":
    "Give office staff the screens their job needs, and nothing more.",
  "guide.operators.caption":
    "One person, the screens ticked on their account, and the save.",
  "guide.operators.s1.title": "Add the person",
  "guide.operators.s1.body":
    "Name, email and a temporary password. The account exists only after the API creates it.",
  "guide.operators.s2.title": "Tick the screens",
  "guide.operators.s2.body":
    "Every tick is a real permission, enforced by the security rules and the API, not a hidden link.",
  "guide.operators.s3.title": "Change or remove access",
  "guide.operators.s3.body":
    "An edit takes effect on the next read. Removing access closes the screens that account no longer holds.",
  "guide.operators.w1.meaning":
    "The one director who opens Operators. A school with a single director is treated as having one.",
  "guide.operators.w2.term": "Grant",
  "guide.operators.w2.meaning":
    "A screen ticked on an operator's account. Unticked means the page is not theirs to open.",

  "guide.legend.title": "Status legend",
  "guide.legend.tldr": "What the colours and the numbers on this dashboard mean.",
  "guide.legend.caption":
    "Three recorded states, the neutral case, and the Off order.",
  "guide.legend.s1.title": "The tint is the state",
  "guide.legend.s1.body":
    "Green is on the bus, blue is off it, red is recorded absent. The label says it too, so colour is never the only carrier.",
  "guide.legend.s2.title": "The Off column is the order",
  "guide.legend.s2.body":
    "Inside a bus the numbers are the order children came off; the last number closes the sequence.",
  "guide.legend.s3.title": "Unaccounted is not a state",
  "guide.legend.s3.body":
    "A child with no record has no status. It reads as a neutral count, never as a warning beside a child who is absent.",
  "guide.legend.w1.term": "Recorded",
  "guide.legend.w1.meaning":
    "A child a driver has tapped. Nothing else counts as attendance.",
  "guide.legend.w2.term": "Retention window",
  "guide.legend.w2.meaning":
    "The last 90 days the roll summarises. Absence is never counted outside it.",

  // Dashboard tour — the invite, then one card per control (src/lib/tour.ts).
  "tour.invite.title": "Want a quick tour?",
  "tour.invite.body":
    "A tour across the dashboard's screens, about two minutes. Stop whenever you like.",
  "tour.invite.start": "Show me around",
  "tour.invite.later": "Not now",
  "tour.stepOf": "Step {current} of {total}",
  "tour.back": "Back",
  "tour.next": "Next",
  "tour.finish": "Done",
  "tour.skip": "Skip the tour",
  "tour.close": "Close the tour",
  "tour.step.nav.title": "Your pages",
  "tour.step.nav.body":
    "Every screen this account can open. A page you were not granted is not here at all.",
  "tour.step.scope.title": "The day and the run",
  "tour.step.scope.body":
    "Pick a day, or switch between morning pickup and afternoon drop-off. Each screen remembers its own day.",
  "tour.step.summary.title": "The day's answer",
  "tour.step.summary.body":
    "How many children are accounted for, out of everyone assigned. Everything else on this page is a way into that number.",
  "tour.step.routes.title": "One row, one bus",
  "tour.step.routes.body":
    "A route row opens that bus: its progress, who is on board, and every child in the order they came off.",
  "tour.step.actions.title": "Dispatch or export",
  "tour.step.actions.body":
    "Dispatch creates a run and pre-registers its students. Export writes the day's rows as a CSV.",
  "tour.step.guide.title": "The guidebook and this tour",
  "tour.step.guide.body":
    "The guidebook explains every screen, Help holds both doors, and this row replays the tour whenever you want it.",
  "tour.step.studentsRoll.title": "The school roll",
  "tour.step.studentsRoll.body":
    "Every child, whatever happened today. Each row summarises the last 90 days: present days, absent days and attendance.",
  "tour.step.studentsToolbar.title": "Narrow the list",
  "tour.step.studentsToolbar.body":
    "Search a name, filter by class, and sort by name or class.",
  "tour.step.studentsHistory.title": "One child's history",
  "tour.step.studentsHistory.body":
    "Each row opens that child's recorded days, one per run, newest first. Nothing is edited from here.",
  "tour.step.reportsOverview.title": "The day, counted",
  "tour.step.reportsOverview.body":
    "The same runs as the monitor, counted instead of listed: the day's totals, then a row per bus with its completion.",
  "tour.step.reportsClasses.title": "Which class needs attention",
  "tour.step.reportsClasses.body":
    "One card per class with present, absent and the attendance rate. Analytics beside the title compares the buses.",
  "tour.step.assignmentsStudents.title": "Move a child",
  "tour.step.assignmentsStudents.body":
    "Pick a bus in the row and the move saves at once. The toggle above the list labels every row by bus or by driver.",
  "tour.step.assignmentsImport.title": "Move a whole sheet",
  "tour.step.assignmentsImport.body":
    "Drop a CSV or XLSX, check the column matching and the preview, then apply. Unmatched rows are reported, never dropped.",
  "tour.step.driversAdd.title": "Create the driver",
  "tour.step.driversAdd.body":
    "A name is enough. The API creates the account and issues the first code with it, so there is nothing else to set up.",
  "tour.step.driversCodes.title": "Copy the code now",
  "tour.step.driversCodes.body":
    "A code is shown once. Regenerating replaces it immediately and the old one stops working, so copy it while it is on screen.",
  "tour.step.operators.title": "Access for the office",
  "tour.step.operators.body":
    "Tick the screens an operator's job needs and nothing more. Every tick is a real permission, enforced by the rules and the API.",


  // Hover hints — one title and one sentence, shown after a 3s dwell on a control
  // (src/components/HoverHint.tsx). Any element can carry `data-hint="<id>"`.
  "hint.scope.title": "Day and run",
  "hint.scope.body":
    "Sets the date and the run segment for this screen only. Another screen keeps its own day.",
  "hint.summary.title": "Accounted for",
  "hint.summary.body":
    "Children with a recorded state today, out of everyone assigned to this run.",
  "hint.unaccounted.title": "Unaccounted",
  "hint.unaccounted.body":
    "Children with no record today, plus those marked absent. A count, never a warning on its own.",
  "hint.routes.title": "Routes",
  "hint.routes.body":
    "Each row is one bus. Open it for the children on that run and the order they came off.",
  "hint.dispatch.title": "Dispatch a vehicle",
  "hint.dispatch.body":
    "Creates a run for a bus, a day and a segment, and pre-registers that bus's students on it.",
  "hint.export.title": "Export CSV",
  "hint.export.body":
    "Downloads every row of the selected run segment, not just what is on screen.",
  "hint.guidebook.title": "Guidebook",
  "hint.guidebook.body":
    "One page per screen: what it answers, how to use it, and the words it uses.",
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
  "analytics.chartDesign": "Chart design",
  "analytics.chartBar": "Bars",
  "analytics.chartDonut": "Donut",
  "analytics.chartCompleted": "Completed trips",
  "analytics.studentsUnit": "students",
  "analytics.fleetAverage": "Fleet average",
  "analytics.averageShort": "Avg",
  "analytics.noData": "No data",
  // The charts' accessible strings. Composed here, not inside the vendored
  // component: word order is ours to get right.
  "analytics.chartSummaryHead": "{chart}, {period}.",
  "analytics.chartSummaryAverage": "Average {value}.",
  "analytics.chartSummaryHighest": "Highest {name}, {value}.",
  "analytics.chartSummaryLowest": "Lowest {name}, {value}.",
  "analytics.chartScrubber": "{chart}, explore by {category}",
  "analytics.legendName": "{chart}, segments. Press a segment to show or hide it.",
  "analytics.segmentAria": "{label}, {value}, {share}",
  "analytics.segmentAriaMembers": "{label}, {value}, {share}. Includes {members}",
  "analytics.segmentHidden": "{label}, hidden",
  "analytics.other": "Other",
  "analytics.emptyTitle": "No attendance data",
  "analytics.emptySubtitle": "No records exist for this date and run segment yet.",

  // Reports
  "reports.title": "Attendance Report",
  "reports.analytics": "Analytics",
  "reports.overview": "Overview",
  "reports.byBus": "Summary by Bus",
  "reports.print": "Print",
  "reports.export": "Export CSV",
  "reports.emptyTitle": "No attendance data",
  "reports.emptySubtitle": "No records exist for this date and run segment yet.",

  // Assignments (director — driver ↔ bus, student ↔ bus)
  "assignments.title": "Assignments",
  "assignments.subtitle": "Assign drivers and students to buses",
  "assignments.modeAria": "Label each student by bus or by driver",
  "assignments.byBus": "By bus",
  "assignments.byDriver": "By driver",
  "assignments.busesEmpty": "No buses have been set up yet.",
  "assignments.drivers": "Drivers",
  "assignments.th.bus": "Bus",
  "assignments.th.driver": "Assigned Driver",
  "assignments.th.assignedStudents": "Assigned Students",
  "assignments.unassigned": "—",
  "assignments.students": "Students",
  "assignments.th.studentName": "Student Name",
  "assignments.th.grade": "Class",
  "assignments.th.currentBus": "Current Bus",
  "assignments.th.currentDriver": "Current driver",
  "assignments.busWithoutDriver": "{bus} · no driver",
  "assignments.noBus": "No bus",
  "assignments.studentsEmpty": "No students found",
  "assignments.studentsEmptyHint": "Adjust your search or load more students.",
  "assignments.filterBusAria": "Filter students by bus",
  "assignments.filterDriverAria": "Filter students by driver",
  "assignments.filterGradeAria": "Filter students by class",
  "assignments.allBuses": "All buses",
  "assignments.filteredCount": "{shown} of {total} students",
  "assignments.filterEmpty": "No students match these filters",
  "assignments.filterEmptyHint": "Pick another bus or class, or clear the filters.",
  "assignments.loadingStudents": "Loading students…",
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
  "drivers.searchAria": "Search drivers",
  "drivers.searchPlaceholder": "Search by driver name…",
  "drivers.searchEmptyTitle": "No drivers match this search",
  "drivers.searchEmptyBody": "Try another name, or clear the search.",
  "drivers.newCodeTitle": "Driver created",
  "drivers.newCodeBody": "Access code for {name}:",
  "drivers.codeOnceHint": "Copy it now — this code won't be shown again.",
  "drivers.copied": "Code copied",
  "drivers.copyError": "Couldn't copy the code",
  "drivers.createdToast": "Driver account created",
  "drivers.codeIssuedToast": "New code for {name} — copy it now",
  "drivers.generateError": "Couldn't generate a code. Try again.",
  "drivers.generateOffline":
    "Can't reach the school server. Check the connection and try again.",
  "drivers.createError": "Couldn't create the driver. Please try again.",

  // Operators (main director — who may open what)
  "operators.title": "Operators",
  "operators.subtitle": "Give office staff the screens their job needs, and nothing more.",
  "operators.create": "Add operator",
  "operators.directors": "Directors",
  "operators.directorsHint":
    "Directors open every screen. Only the main director can change this page.",
  "operators.operators": "Operators",
  "operators.operatorsHint": "Each person opens the screens ticked on their account.",
  "operators.empty": "No operators yet",
  "operators.emptyHint":
    "Add a colleague to give them part of the dashboard, without handing over the whole school.",
  "operators.screensLabel": "Screens",
  "operators.screen.live": "Live monitor",
  "operators.screen.students": "Students",
  "operators.screen.reports": "Reports",
  "operators.screen.assignments": "Assignments",
  "operators.screen.drivers": "Drivers",
  "operators.edit": "Edit access",
  "operators.remove": "Remove access",
  "operators.removeConfirmTitle": "Remove access?",
  "operators.removeConfirmBody":
    "{name} will be signed out and will no longer open the dashboard. You can add them again later.",
  "operators.newTitle": "Add an operator",
  "operators.editTitle": "Access for {name}",
  "operators.nameLabel": "Full name",
  "operators.namePlaceholder": "e.g. Mona Farah",
  "operators.emailLabel": "Email",
  "operators.emailPlaceholder": "name@school.edu",
  "operators.passwordLabel": "Temporary password",
  "operators.passwordHint":
    "At least 12 characters, mixing upper and lower case, a number and a symbol. The app will not email it.",
  "operators.newPasswordLabel": "New password (optional)",
  "operators.newPasswordHint":
    "Leave it blank to keep the current password. It is never shown again.",
  "operators.showPassword": "Show password",
  "operators.hidePassword": "Hide password",
  "operators.generate": "Generate",
  "operators.pw.length": "12 characters or more",
  "operators.pw.upper": "An uppercase letter",
  "operators.pw.lower": "A lowercase letter",
  "operators.pw.digit": "A number",
  "operators.pw.symbol": "A symbol",
  "operators.pw.progress": "{met} of {total} requirements met",
  "operators.passwordWeak": "The password doesn't meet every check yet.",
  "operators.passwordChanged": "Password changed",
  "operators.passwordError": "Couldn't change the password. Try again.",
  "operators.createdTitle": "Operator added",
  "operators.createdBody": "{name} signs in with these details.",
  "operators.passwordRow": "Password",
  "operators.copyPassword": "Copy password",
  "operators.copied": "Copied",
  "operators.copyError": "Couldn't copy the password",
  "operators.credentialsHint":
    "Shown once — hand it over now. You can set a new one from the list at any time.",
  "operators.screensHint": "Tick only what their job needs.",
  "operators.createAction": "Create account",
  "operators.save": "Save screens",
  "operators.created": "Operator added",
  "operators.saved": "Screens updated",
  "operators.removed": "Access removed",
  "operators.emailTaken": "That email already has an account.",
  "operators.createError": "Couldn't add the operator. Try again.",
  "operators.updateError": "Couldn't update the screens. Try again.",
  "operators.removeError": "Couldn't remove the access. Try again.",
  "operators.screensRequired": "Choose at least one screen.",
  "operators.selfTag": "You",
  "operators.ownerTag": "Main director",

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

  // Driver access code — six-box input, verified state
  "login.codeDigitAria": "{label} — digit {index} of {total}",
  "login.codeChecking": "Checking the code…",
  "login.codeVerified": "Code verified",
  "login.codeVerifiedHint": "Signing you in…",
  "login.networkError":
    "Can't reach the school server. Check the connection and try again.",
  "login.serverError": "The school server had a problem. Try again in a moment.",

  // ── Students: the school roll, its own section ────────────────────────────
  "students.title": "Students",
  "students.subtitle": "{school} · {count} on the roll · {classes} classes",
  "students.roll": "School roll",
  "students.edit.title": "Edit student",
  "students.edit.aria": "Edit {name}",
  "students.edit.name": "Name",
  "students.edit.grade": "Class",
  "students.edit.classEmpty": "Choose a class",
  "students.edit.sheetNote":
    "If today's run is not signed off, its sheet is corrected too. Past days keep the name they recorded.",
  "students.edit.save": "Save changes",
  "students.edit.cancel": "Cancel",
  "students.edit.saved": "Student updated",
  "students.meta": "{count} students · {sort}",
  "students.meta.one": "{count} student · {sort}",
  "students.retention": "Records are kept for 90 days",
  "students.add": "Add student",
  "students.addHint": "Students are added on the Assignments screen",
  "students.sortAria": "Sort students",
  "students.sort.runOrder": "Run order",
  "students.sort.name": "Name A–Z",
  "students.sort.grade": "Class",
  // The roll with no date picked: every student, summarised over the window.
  "students.th.present": "Present",
  "students.th.absent": "Absent",
  "students.th.attendance": "Attendance",
  "students.th.lastRecord": "Last record",
  "students.presentTitle": "Days with a recorded run in the last {days} days",
  "students.absentTitle": "Days marked absent in the last {days} days",
  "students.attendanceTitle": "Present days out of the days with a record",
  "students.noRecord": "No records",
  "students.rollCaption":
    "Every student on the roll, with presence over the last {days} days",
  "students.phonePresence": "Present {present} · Absent {absent} · {percent}%",
  "students.phoneLastRecord": "Last record {date}",
  "students.emptyRollTitle": "No students on the roll",
  "students.emptyRollSubtitle": "Add students on the Assignments screen.",
  "students.noMatchTitle": "No students match these filters",
  "students.noMatchSubtitle": "Try another name, or clear the filters.",

  // ── One bus's sheet (the drop-off order lives here) ──────────────────────
  "busDetail.hint": "{driver} · {count} students · {percent}% complete",
  "busDetail.hint.one": "{driver} · {count} student · {percent}% complete",
  "busDetail.offColumn": "Off",
  "busDetail.caption": "{bus}: students in the order they came off the bus",
  "busDetail.foot": "{off} of {total} off the bus · first off {time}",
  "busDetail.openInStudents": "Open in Students",
  "busDetail.unaccounted": "Unaccounted",

  // ── Reports: classes are cards ───────────────────────────────────────────
  "reports.classes": "Classes",
  "reports.classesMeta": "{classes} classes · {students} students",
  "reports.sortAria": "Order the classes",
  "reports.sort.grade": "Class A–Z",
  "reports.sort.absent": "Most absent",
  "reports.sort.completion": "Lowest completion",
  "reports.sort.size": "Most students",
  "reports.allClasses": "All classes",
  "reports.classSearchPlaceholder": "Search a class…",
  "reports.classSearchEmpty": "No class matches that name.",
  "reports.openClassHint": "Tap a class to see its students.",
  "reports.classCount": "{count} students",
  "reports.classCountOne": "{count} student",
  "reports.classCompletion": "{percent}% of the run complete",
  "reports.classCaption": "{grade} students, in name order",
  "sheet.title": "Import a sheet",
  "sheet.template": "Download template",
  "sheet.import": "Import sheet",
  "sheet.dropTitle": "Drop a class list here",
  "sheet.dropDesc": "or choose a CSV or Excel file — one sheet, up to 10 MB",
  "sheet.dropNote": "Columns are matched automatically. Nothing is written until you confirm.",
  "sheet.ready": "Ready to match",
  "sheet.matchColumns": "Match columns",
  "sheet.mappingTitle": "Match the columns",
  "sheet.mappingHint": "{file} · {sheet} · {rows} rows read",
  "sheet.whereEachColumn": "Where each column goes",
  "sheet.whereEachColumnHint":
    "We matched {matched} of {total} columns. Change any of them before applying.",
  "sheet.columnLetter": "Column {letter}",
  "sheet.matchedOn": "matched on {name}",
  "sheet.notMatched": "not matched",
  "sheet.field.studentName": "Student name",
  "sheet.field.grade": "Class",
  "sheet.field.bus": "Bus",
  "sheet.field.ignore": "Ignore",
  "sheet.previewTitle": "Preview — first {shown} of {total} rows",
  "sheet.previewNote":
    "The classes and the new students are listed before you apply — nothing is guessed.",
  "sheet.resultNew": "{count} new students",
  "sheet.resultUpdate": "{count} students updated",
  "sheet.resultUnchanged": "{count} already match",
  "sheet.resultUnmatched": "{count} rows not applied",
  "sheet.classesTitle": "Classes in this file",
  "sheet.classNew": "new",
  "sheet.classesNote":
    "Spellings that differ only in capitals, spacing or the word Class/Grade count as one class.",
  "sheet.newChildrenLabel": "New students:",
  "sheet.notAppliedLabel": "Not applied:",
  "sheet.moreNames": "+{count} more",
  "sheet.needsStudents":
    "Creating a student or setting a class needs the Students permission. Moving a child between buses alone does not.",
  "sheet.apply": "Apply {count} changes",
  "sheet.nothingWritten": "Nothing is written until you apply.",
  "sheet.back": "Back",
  "sheet.imported": "Imported {count} students",
  "sheet.unreadable": "That file could not be read. Save it as CSV or an Excel workbook.",
  "sheet.dz.files": "Files",
  "sheet.dz.remove": "Remove {name}",
  "sheet.dz.retry": "Retry",
  "sheet.dz.uploading": "Uploading",
  "sheet.dz.uploaded": "Uploaded",
  "sheet.dz.uploadFailed": "The file could not be read",
  "sheet.dz.failed": "Failed:",
  "sheet.dz.wrongTypeOne": "{name} is not an accepted file type.",
  "sheet.dz.wrongTypeMany": "Some files were not added: their type is not accepted.",
  "sheet.dz.tooMany": "You can add {count} files at most.",
  "sheet.dz.dropOne": "Drop to add the file",
  "sheet.dz.dropMany": "Drop to add files",

  // ── History: which day, from a calendar ──────────────────────────────────
  "history.daysWithRecords": "{count} days with records in {month}",
  "history.dayWithRecords": "Day with records",
  "history.noRecordsLegend": "No records",
  "history.schoolDays": "{have} of {total} school days",
  "history.notStarted": "Not started yet",
  "history.recordedByDriver": "Recorded by the driver app",
  "history.dayOpen": "This day's record is still open — the afternoon run has not begun.",
  "history.previousMonth": "Previous month",
  "history.nextMonth": "Next month",

  // ── activity log ────────────────────────────────────────────────────────
  "nav.activity": "Activity",
  "guide.activity.tldr":
    "Every change made in the school, in order, with who made it — and no way to edit it afterwards.",
  "guide.activity.caption": "The five counters are also the filter; a row opens its before-and-after.",
  "guide.activity.s1.title": "Counters first",
  "guide.activity.s1.body":
    "The strip says what happened before you read anything: how much was access, how much was the roll, how much was the school's own settings.",
  "guide.activity.s2.title": "Newest first, always",
  "guide.activity.s2.body":
    "Rows are ordered by when the school's server received them. A tap made on a bus with no signal is recorded when it finally arrives — the entry carries the device time too, shown under the row.",
  "guide.activity.s3.title": "Open a row",
  "guide.activity.s3.body":
    "A row expands to the fields that changed, before and after, and to where the entry came from — the server or the browser.",
  "guide.activity.w1.term": "Recorded by the browser",
  "guide.activity.w1.meaning":
    "The change and its entry were written together, pinned to whoever made it. The entry cannot be edited, but its values are what that person's device reported.",
  "guide.activity.w2.term": "Recorded by the server",
  "guide.activity.w2.meaning":
    "An account or sign-in event, written by the school's server from a verified session — the stronger half of the log.",
  "guide.activity.miniRow1": "Sara M. moved Yusuf K. from Bus 03 to Bus 07",
  "guide.activity.miniFrom": "Bus 03",
  "guide.activity.miniTo": "Bus 07",
  "activity.unknownEvent": "an event this version does not recognise",
  "activity.none": "—",
  "activity.yes": "Yes",
  "activity.no": "No",
  "activity.actorColumn": "Who",
  "activity.outcomeColumn": "Outcome",
  "activity.outcome.success": "Done",
  "activity.preset.today": "Today",
  "activity.preset.days": "Last {count} days",
  "activity.preset.days.one": "Last {count} day",
  "activity.title": "Activity",
  "activity.subtitle":
    "Every change made in this school, newest first. Read-only — entries are kept for 12 months.",
  "activity.finding.changes": "{count} changes in this window · the last was {when}",
  "activity.finding.changes.one": "{count} change in this window · the last was {when}",
  "activity.finding.failed": "{count} sign-in attempts failed in this window",
  "activity.finding.failed.one": "{count} sign-in attempt failed in this window",

  "activity.family.all": "All",
  "activity.family.access": "Access",
  "activity.family.student": "Students",
  "activity.family.roll": "Roll",
  "activity.family.settings": "School",
  "activity.family.aria": "Narrow to one kind of change",

  "activity.filter.actor": "Everyone",
  "activity.filter.actorAria": "Narrow to one person",
  "activity.filter.system": "System",
  "activity.filter.range": "Dates",
  "activity.filter.clear": "Clear filters",
  "activity.filter.showing": "{shown} of {total}",

  "activity.col.what": "What happened",
  "activity.col.when": "When",
  "activity.expand": "Show details",
  "activity.collapse": "Hide details",

  "activity.empty.title": "No activity yet",
  "activity.empty.body": "Changes appear here as they happen. Widen the dates to look further back.",
  "activity.noMatch.title": "Nothing matches these filters",
  "activity.noMatch.body": "Widen the dates, or choose All.",
  "activity.error.title": "The activity log could not be loaded",
  "activity.error.body": "Nothing is lost — the entries are still stored. Try again.",
  "activity.retry": "Try again",
  "activity.export": "Export CSV",

  "activity.details.title": "Technical details",
  "activity.details.recorded": "Recorded",
  "activity.details.pressed": "Device time",
  "activity.details.writtenBy": "Written by",
  "activity.details.entry": "Entry",
  "activity.source.api": "the server",
  "activity.source.client": "the browser",
  "activity.source.system": "a maintenance script",
  "activity.changes.field": "Field",
  "activity.changes.before": "Before",
  "activity.changes.after": "After",
  "activity.changes.none": "No field values were recorded for this entry.",

  "activity.unknownActor": "Unknown account",
  "activity.removed": "Removed student",
  "activity.noBus": "no bus",
  "activity.noDriver": "no driver",
  "activity.outcome.failed": "Failed",

  "activity.field.busId": "Bus",
  "activity.field.status": "Status",
  "activity.field.driver": "Driver",
  "activity.field.assignmentMode": "Assignments column",
  "activity.field.screens": "Screens",
  "activity.field.owner": "Main director",
  "activity.mode.bus": "bus",
  "activity.mode.driver": "driver",

  "activity.event.studentUpdated": "{actor} changed the details of {target}",
  "activity.event.signIn": "{actor} signed in",
  "activity.event.signInFailed": "A sign-in attempt failed for {actor}",
  "activity.event.codeSignIn": "{actor} signed in with an access code",
  "activity.event.driverCreated": "{actor} created a driver account for {target}",
  "activity.event.codeRotated": "{actor} generated a new access code for {target}",
  "activity.event.operatorCreated": "{actor} created an operator account for {target}",
  "activity.event.screensChanged": "{actor} changed which screens {target} may open",
  "activity.event.passwordReset": "{actor} set a new password for {target}",
  "activity.event.operatorRemoved": "{actor} removed the operator {target}",
  "activity.event.ownerChanged": "{actor} made {target} the main director",
  "activity.event.busChanged": "{actor} moved {target} from {from} to {to}",
  "activity.event.driverChanged": "{actor} set {bus}'s driver to {driver}",
  "activity.event.attendanceChanged": "{actor} recorded {target} as {to}",
  "activity.event.runCompleted":
    "{actor} completed {bus}'s run; {count} unrecorded students were marked absent",
  "activity.event.runCompleted.one":
    "{actor} completed {bus}'s run; {count} unrecorded student was marked absent",
  "activity.event.runDispatched": "{actor} dispatched {bus} to {count} students",
  "activity.event.runDispatched.one": "{actor} dispatched {bus} to {count} student",
  "activity.event.imported": "{actor} imported a sheet and moved {count} students",
  "activity.event.imported.one": "{actor} imported a sheet and moved {count} student",
  "activity.event.assignmentModeChanged": "{actor} switched the Assignments column to {to}",
  "activity.event.exported": "{actor} exported this log",
};

/** Key set is the object's keys; every value is a plain string. */
export type Messages = Record<keyof typeof messages, string>;
