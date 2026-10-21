/**
 * Arabic strings. Must satisfy `Messages` (the key set from en.ts). Where a
 * number is embedded we use Eastern Arabic digits (٠١٢٣) inline or a `{var}`
 * placeholder that the caller digitizes via toLocaleDigits().
 */

import type { Messages } from "./en";

export const messages: Messages = {
  // Browser-tab metadata
  "meta.title": "النقل المدرسي",
  "meta.description": "متابعة الحضور والنقل المدرسي",
  "meta.mobileTitle": "حافلة #٠٤ • الرحلة الصباحية",
  "meta.mobileDescription": "قائمة حضور الحافلة المدرسية",
  "meta.dashboardTitle": "مراقب النقل المدرسي المباشر",
  "meta.dashboardDescription": "لوحة مراقبة النقل المدرسي لحظياً",

  // Login screen
  "login.heading": "النقل المدرسي",
  "login.subtitle": "متابعة الحضور والمسارات للنقل المدرسي.",
  "login.driverTab": "رمز السائق",
  "login.directorTab": "المدير",
  "login.modeAria": "اختر طريقة تسجيل الدخول",
  "login.code": "رمز الوصول",
  "login.codePlaceholder": "٠٠٠٠٠٠",
  "login.codeError": "هذا الرمز غير صحيح. تحقق منه وحاول مرة أخرى.",
  "login.codeLocked": "محاولات كثيرة. حاول مرة أخرى بعد {minutes} دقيقة.",
  "login.driverHint": "اطلب من مدير المدرسة رمز الوصول المكوّن من ٦ أرقام.",
  "login.email": "البريد الإلكتروني",
  "login.password": "كلمة المرور",
  "login.emailPlaceholder": "you@school.edu",
  "login.passwordPlaceholder": "••••••••",
  "login.signIn": "تسجيل الدخول",
  "login.fallbackError": "فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.",
  "login.notDirector":
    "هذا البريد لحساب سائق. يدخل السائقون برمز الوصول من تبويب «رمز السائق».",
  "login.tooManyAttempts": "محاولات دخول كثيرة. انتظر بضع دقائق ثم أعد المحاولة.",
  "login.notConfiguredTitle": "لم يتم إعداد Firebase",
  "login.notConfiguredBody":
    "أدخل المفاتيح في {code} لتفعيل تسجيل الدخول. يعمل التطبيق على بيانات تجريبية.",
  "login.backToApp": "العودة إلى التطبيق",

  // Mobile roster screen
  "mobile.loading": "جارٍ تحميل القائمة…",
  "mobile.appBarTitle": "حافلة {bus}",
  "mobile.appBarTitleNoBus": "الرحلة الصباحية",
  "mobile.runTitle": "الرحلة الصباحية",
  "mobile.runDate": "{date}",
  "mobile.runInProgress": "قيد التنفيذ",
  "mobile.runCompleted": "اكتملت الرحلة",
  "mobile.runNotStarted": "لم تُرسل رحلة",
  "mobile.moreOptionsAria": "خيارات إضافية",
  "mobile.moreOptionsForAria": "خيارات إضافية لـ {name}",
  "mobile.searchAria": "بحث عن الطلاب",
  "mobile.searchPlaceholder": "ابحث عن طالب",
  "mobile.clearSearchAria": "مسح البحث",
  "mobile.emptyTitle": "لا يوجد طلاب",
  "mobile.emptySubtitle": "جرّب اسماً أو تصفية أخرى.",
  "mobile.noRunTitle": "لا توجد رحلة اليوم",
  "mobile.noRunBody":
    "لم يُرسل مدير المدرسة رحلة هذه الحافلة الصباحية بعد. ستظهر هنا عند إرسالها.",
  "mobile.syncStatus": "حالة المزامنة",
  "mobile.online": "مباشر",
  "mobile.offline": "دون اتصال — التغييرات محفوظة",
  "mobile.offlineHint":
    "أنت دون اتصال. تُحفظ تغييرات الحالة وتُزامن عند عودة الشبكة.",
  "mobile.summaryOnboard": "على المتن",
  "mobile.summaryDropped": "تم التوصيل",
  "mobile.summaryWaiting": "بالانتظار",
  "mobile.summaryAbsent": "غائب",
  "mobile.summaryAria": "إجماليات الرحلة",
  "mobile.statusHint": "اضغط الحالة لتحديثها",
  "mobile.completeRun": "إنهاء الرحلة",
  "mobile.completing": "جارٍ الإنهاء…",
  "mobile.completed": "اكتملت الرحلة",
  "mobile.signInPromptTitle": "سجّل الدخول لعرض قائمة الحضور الحية",
  "mobile.signInPromptBody":
    "تُحمَّل القائمة من بيانات مدرستك الحية بعد تسجيل الدخول.",
  "mobile.signInAction": "تسجيل الدخول",
  "mobile.noBusTitle": "لا توجد حافلة معيّنة",
  "mobile.noBusBody":
    "حسابك غير مرتبط بحافلة بعد. اطلب من مدير المدرسة تعيين حافلة لك.",

  // Roster filter tabs
  "tabs.filterAria": "تصفية الطلاب حسب الحالة",
  "tabs.all": "الكل",
  "tabs.waiting": "بالانتظار",
  "tabs.boarded": "على المتن",
  "tabs.done": "تم",

  // Attendance statuses (shared mobile pills/chips + dashboard badges)
  "status.boarded": "على المتن",
  "status.waiting": "بالانتظار",
  "status.droppedOff": "تم التوصيل",
  "status.absent": "غائب",

  // Route guard
  "guard.checking": "جارٍ التحقق من الوصول…",

  // Translatable prefixes embedded in data labels (e.g. "Bus 04", "Grade 4B")
  "bus.bus": "حافلة",
  "bus.grade": "الصف",

  // Run-type labels
  "runType.morningPickup": "الاستلام الصباحي",
  "runType.afternoonDropoff": "التوصيل المسائي",

  // Dashboard sidebar nav
  "nav.liveMap": "المراقب المباشر",
  "nav.fleet": "حالة الأسطول",
  "nav.routes": "المسارات",
  "nav.reports": "التقارير",
  "nav.assignments": "التعيينات",
  "nav.drivers": "السائقون",
  "nav.dispatch": "إرسال حافلة",
  "nav.operate": "التشغيل",
  "nav.manage": "الإدارة",

  // Dashboard screen
  "dashboard.title": "المراقب المباشر",
  "dashboard.loading": "جارٍ تحميل البيانات الحية…",
  "dashboard.activeFleet": "المسارات",
  "dashboard.enRouteOne": "حافلة واحدة في الطريق",
  "dashboard.enRouteMany": "{count} حافلة في الطريق",
  "dashboard.enRouteOf": "{active} من {total} في الطريق",
  "dashboard.liveAttendance": "قائمة الطلاب",
  "dashboard.liveUpdating": "مباشر",
  "dashboard.caption": "حضور الطلاب المباشر",
  "dashboard.th.studentName": "الطالب",
  "dashboard.th.grade": "الصف",
  "dashboard.th.bus": "الحافلة",
  "dashboard.th.morningBoarded": "وقت الركوب",
  "dashboard.th.dropOffTime": "وقت التوصيل",
  "dashboard.th.currentStatus": "الحالة",
  "dashboard.th.waiting": "بالانتظار",
  "dashboard.th.actions": "السجل",
  "dashboard.th.assigned": "المخصص",
  "dashboard.th.completion": "الإكمال",
  "dashboard.emptyTitle": "لا يوجد طلاب يطابقون هذه التصفية",
  "dashboard.emptySubtitle": "امسح البحث أو اختر حالة أخرى.",
  "dashboard.callAria": "اتصال بـ {name}",
  "dashboard.historyAria": "عرض السجل لـ {name}",
  "dashboard.driver": "السائق: {name}",
  "dashboard.noDriver": "لا يوجد سائق معيّن",
  "dashboard.inProgress": "قيد التنفيذ",
  "dashboard.completed": "مكتمل",
  "dashboard.routeProgress": "تقدم المسار",
  "dashboard.routeComplete": "{percent}٪ مكتمل",
  "dashboard.in": "على المتن",
  "dashboard.out": "تم التوصيل",
  "dashboard.wait": "بالانتظار",
  "dashboard.today": "اليوم",
  "dashboard.runTypeAria": "نوع الرحلة",
  "dashboard.export": "تصدير CSV",
  "dashboard.selectDate": "اختر تاريخاً",
  "dashboard.prevMonth": "الشهر السابق",
  "dashboard.nextMonth": "الشهر التالي",
  "dashboard.liveUnavailable": "البيانات الحية غير متاحة — سجّل الدخول للمتابعة.",
  "dashboard.notificationsAria": "الإشعارات",
  "dashboard.helpAria": "المساعدة",
  "dashboard.settingsAria": "الإعدادات",
  "dashboard.noContactNumber": "لا يوجد رقم اتصال مسجل",
  "dashboard.openNavAria": "فتح قائمة التنقل",
  "dashboard.closeNavAria": "إغلاق قائمة التنقل",

  // The screen's answer, in one line under the title
  "dashboard.accountedLabel": "تم التحقق منهم",
  "dashboard.accounted": "{accounted} من {total} تم التحقق منهم",
  "dashboard.summary.open": "{count} لم يُتحقق منهم بعد",
  "dashboard.summary.breakdown":
    "{onboard} على المتن · {dropped} تم توصيلهم · {open} مفتوح",
  "dashboard.finding.empty": "لم يُسجَّل أي حضور لهذه الرحلة بعد.",
  "dashboard.noRoutes": "لم تُرسل أي مسارات لهذه الرحلة.",
  "dashboard.finding.allClear": "تم التحقق من جميع الطلاب ({total}).",
  "dashboard.finding.open": "لم يُتحقق من {count} من أصل {total} طالباً بعد.",
  "dashboard.finding.completedWithWaiting":
    "تم إنهاء {bus} مع {count} طالباً ما زالوا بالانتظار.",
  "dashboard.scope": "{school} · {date} · {segment}",
  "dashboard.addRun": "إرسال حافلة",

  // Student list (dashboard) — search, filters, and pagination
  "studentList.searchAria": "بحث عن الطلاب",
  "studentList.searchPlaceholder": "ابحث عن اسم الطالب…",
  "studentList.statusAria": "تصفية حسب الحالة",
  "studentList.gradeAria": "تصفية حسب الصف",
  "studentList.allGrades": "كل الصفوف",
  "studentList.clear": "مسح التصفية",
  "studentList.showing": "عرض {start}–{end} من {total}",
  "studentList.previousAria": "الصفحة السابقة",
  "studentList.nextAria": "الصفحة التالية",
  "studentList.pageAria": "الصفحة {page} من {pages}",

  // KPI cells — labels are nouns, footers are computed captions
  "kpi.total.label": "المخصصون",
  "kpi.total.footer": "عبر {count} مسارات",
  "kpi.onboard.label": "على المتن",
  "kpi.onboard.footer": "{percent}٪ من المخصصين",
  "kpi.dropped.label": "تم توصيلهم",
  "kpi.dropped.footer": "{percent}٪ من المخصصين",
  "kpi.absent.label": "لم يُتحقق منهم",
  "kpi.absent.footer": "{waiting} بالانتظار · {absent} غائب",

  // Roles
  "role.director": "مدير",
  "role.staff": "مشرف",

  // Shared dialogs
  "dialog.close": "إغلاق",
  "dialog.cancel": "إلغاء",
  "dialog.confirm": "تأكيد",

  // Run details (mobile overflow sheet)
  "runDetails.title": "تفاصيل الرحلة",
  "runDetails.bus": "الحافلة",
  "runDetails.type": "نوع الرحلة",
  "runDetails.date": "التاريخ",
  "runDetails.status": "الحالة",
  "runDetails.noRun": "لم تبدأ رحلة بعد",

  // Student attendance history
  "history.title": "سجل الحضور",
  "history.loading": "جارٍ تحميل السجل…",
  "history.empty": "لا يوجد سجل حضور لهذا الطالب",
  "history.loadMore": "تحميل المزيد",
  "history.col.date": "التاريخ",
  "history.col.run": "الرحلة",
  "history.col.status": "الحالة",
  "history.col.bus": "الحافلة",

  // Confirm dialogs
  "confirm.completeRun.title": "إكمال هذه الرحلة؟",
  "confirm.completeRun.body":
    "سيتم وضع علامة غياب على الطلاب المنتظرين. لا يمكن التراجع.",
  "confirm.signOut.title": "تسجيل الخروج؟",
  "confirm.signOut.body": "ستُعاد إلى شاشة تسجيل الدخول.",

  // Dispatch vehicle
  "dispatch.title": "إرسال حافلة",
  "dispatch.bus": "الحافلة",
  "dispatch.runType": "نوع الرحلة",
  "dispatch.date": "التاريخ",
  "dispatch.selectBus": "اختر حافلة",
  "dispatch.submit": "إرسال",
  "dispatch.loadError": "تعذّر تحميل قائمة الحافلات.",

  // Student kebab menu
  "kebab.viewHistory": "عرض السجل",
  "kebab.markAbsent": "وضع علامة غياب",

  // Settings drawer
  "settings.title": "الإعدادات",
  "settings.account": "الحساب",
  "settings.email": "البريد الإلكتروني",
  "settings.role": "الدور",
  "settings.language": "اللغة",
  "settings.signOut": "تسجيل الخروج",

  // Help dialog
  "help.title": "المساعدة",
  "help.content":
    "تعرض لوحة التحكم حالة الحافلات الحية والمؤشرات وقائمة حضور الطلاب.\nاستخدم عنصر التحكم في نوع الرحلة للتبديل بين الاستلام الصباحي والتوصيل المسائي.\nاختر تاريخاً لعرض يوم سابق.\nالإرسال ينشئ رحلة جديدة ويسجل الطلاب المنتظرين.\nالتصدير ينزّل الصفوف المفلترة الحالية كملف CSV.",

  // Toasts
  "toast.exported": "تم تصدير {count} صفاً",
  "toast.dispatched": "تم إرسال الحافلة",
  "toast.runCompleted": "اكتملت الرحلة",
  "toast.signedOut": "تم تسجيل الخروج",
  "toast.markedAbsent": "تم وضع علامة غياب على {name}",
  "toast.dispatchExists": "توجد رحلة مسبقة لهذه الحافلة والتاريخ والنوع",
  "toast.error": "حدث خطأ ما. حاول مرة أخرى.",

  // Analytics (modal opened from Reports)
  "analytics.title": "تحليلات الحضور",
  "analytics.perBus": "مقارنة حسب الحافلة",
  "analytics.trendTitle": "اتجاه متعدد الأيام",
  "analytics.trendHint": "إجماليات يومية عبر نطاق زمني",
  "analytics.startDate": "تاريخ البداية",
  "analytics.endDate": "تاريخ النهاية",
  "analytics.trendLoading": "جارٍ تحميل الاتجاه…",
  "analytics.trendEmpty": "لا توجد بيانات حضور في هذا النطاق",
  "analytics.rangeTooLong": "النطاق الزمني طويل جداً — الحد الأقصى ٣١ يوماً",
  "analytics.rangeInvalid": "يجب أن يكون تاريخ البداية قبل تاريخ النهاية",
  "analytics.emptyTitle": "لا توجد بيانات حضور",
  "analytics.emptySubtitle": "لا توجد سجلات لهذا التاريخ ونوع الرحلة بعد.",

  // Reports
  "reports.title": "تقرير الحضور",
  "reports.subtitle": "ملخص حضوري قابل للطباعة لليوم المحدد ونوع الرحلة",
  "reports.analytics": "التحليلات",
  "reports.overview": "نظرة عامة",
  "reports.byBus": "الملخص حسب الحافلة",
  "reports.byGrade": "الملخص حسب الصف",
  "reports.roster": "قائمة الحضور",
  "reports.print": "طباعة",
  "reports.export": "تصدير CSV",
  "reports.emptyTitle": "لا توجد بيانات حضور",
  "reports.emptySubtitle": "لا توجد سجلات لهذا التاريخ ونوع الرحلة بعد.",

  // Assignments (director — driver ↔ bus, student ↔ bus)
  "assignments.title": "التعيينات",
  "assignments.subtitle": "تعيين السائقين والطلاب للحافلات",
  "assignments.drivers": "السائقون",
  "assignments.th.bus": "الحافلة",
  "assignments.th.driver": "السائق المعيّن",
  "assignments.th.assignedStudents": "الطلاب المعيّنون",
  "assignments.unassigned": "—",
  "assignments.students": "الطلاب",
  "assignments.th.studentName": "اسم الطالب",
  "assignments.th.grade": "الصف",
  "assignments.th.currentBus": "الحافلة الحالية",
  "assignments.noBus": "لا توجد حافلة",
  "assignments.studentsEmpty": "لا يوجد طلاب",
  "assignments.studentsEmptyHint": "عدّل البحث أو حمّل المزيد من الطلاب.",
  "assignments.loadingStudents": "جارٍ تحميل الطلاب…",
  "assignments.loadMore": "تحميل المزيد",
  "assignments.driverAssigned": "تم تعيين السائق",
  "assignments.driverCleared": "تم إلغاء تعيين السائق",
  "assignments.studentMoved": "تم تحديث حافلة الطالب",

  // Drivers (director — driver accounts + access codes)
  "drivers.title": "السائقون",
  "drivers.subtitle": "إنشاء حسابات السائقين وإدارة رموز الوصول",
  "drivers.addTitle": "إضافة سائق",
  "drivers.nameLabel": "اسم السائق",
  "drivers.namePlaceholder": "مثال: ريتا باتل",
  "drivers.create": "إنشاء وتوليد رمز",
  "drivers.accessCodes": "رموز الوصول",
  "drivers.th.name": "السائق",
  "drivers.th.bus": "الحافلة",
  "drivers.th.code": "رمز الوصول",
  "drivers.noBus": "غير معيّن",
  "drivers.generateCode": "توليد رمز",
  "drivers.revealAria": "إظهار رمز {name}",
  "drivers.hideAria": "إخفاء رمز {name}",
  "drivers.copyAria": "نسخ رمز {name}",
  "drivers.regenerateAria": "إعادة توليد رمز {name}",
  "drivers.regenerateConfirmTitle": "إعادة توليد الرمز؟",
  "drivers.regenerateConfirmBody":
    "سيحصل {name} على رمز جديد. سيتوقف الرمز القديم عن العمل.",
  "drivers.empty": "لا يوجد سائقون بعد",
  "drivers.emptyHint": "أضف سائقاً لتوليد رمز الوصول الخاص به.",
  "drivers.newCodeTitle": "تم إنشاء السائق",
  "drivers.newCodeBody": "رمز الوصول لـ {name}:",
  "drivers.copied": "تم نسخ الرمز",
  "drivers.copyError": "تعذّر نسخ الرمز",
  "drivers.createdToast": "تم إنشاء حساب السائق",
  "drivers.regeneratedToast": "تم تحديث رمز الوصول",
  "drivers.createError": "تعذّر إنشاء السائق. حاول مرة أخرى.",

  // Common
  "common.changeLanguageAria": "تغيير اللغة",
  "common.loading": "جارٍ التحميل",
};
