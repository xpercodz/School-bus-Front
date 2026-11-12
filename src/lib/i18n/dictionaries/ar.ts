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
  "login.showPassword": "إظهار كلمة المرور",
  "login.hidePassword": "إخفاء كلمة المرور",
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
  "mobile.writeFailed": "لم يُحفظ ذلك التغيير. إذا تكرر ذلك، أبلغ مكتب المدرسة.",
  "mobile.offlineHint":
    "أنت دون اتصال. تُحفظ تغييرات الحالة وتُزامن عند عودة الشبكة.",
  "mobile.summaryOnboard": "على المتن",
  "mobile.summaryDropped": "تم التوصيل",
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
  "tabs.boarded": "على المتن",
  "tabs.done": "تم",

  // Attendance statuses (shared mobile pills/chips + dashboard badges)
  "status.boarded": "على المتن",
  "status.waiting": "غير محتسب",
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
  "nav.students": "الطلاب",
  "mobile.markBoarded": "تسجيل الركوب",
  "nav.reports": "التقارير",
  "nav.assignments": "التعيينات",
  "nav.drivers": "السائقون",
  "nav.operators": "المشغّلون",
  "nav.dispatch": "إرسال حافلة",
  "nav.primaryAria": "التنقل الرئيسي",
  "nav.operate": "التشغيل",
  // تسميات قصيرة لشريط التنقل السفلي في الهاتف.
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
  "dashboard.th.waiting": "غير محتسب",
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
  "dashboard.routeProgress": "تقدم الرحلة",
  "dashboard.routeComplete": "{percent}٪ مكتمل",
  "dashboard.in": "على المتن",
  "dashboard.out": "تم التوصيل",
  "dashboard.today": "اليوم",
  "dashboard.runTypeAria": "نوع الرحلة",
  "dashboard.export": "تصدير CSV",
  "dashboard.selectDate": "اختر تاريخاً",
  "dashboard.prevMonth": "الشهر السابق",
  "dashboard.nextMonth": "الشهر التالي",
  "datePicker.clear": "مسح",
  "datePicker.chooseDay": "اختر يوماً",
  "datePicker.selected": "المحدد {date}",
  "datePicker.calendar": "تقويم {label}",
  "datePicker.todayWithDate": "اليوم، {date}",
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
  "dashboard.finding.allClear.one": "تم التحقق من الطالب ({total}).",
  "dashboard.finding.open": "لم يُتحقق من {count} من أصل {total} طالباً بعد.",
  "dashboard.finding.open.one": "لم يُتحقق من {count} من أصل {total} طالب بعد.",
  "dashboard.finding.completedWithWaiting":
    "تم إنهاء {bus} مع {count} بلا سجل.",
  "dashboard.finding.completedWithWaiting.one":
    "تم إنهاء {bus} مع {count} بلا سجل.",
  "dashboard.scope": "{school} · {date} · {segment}",
  "dashboard.addRun": "إرسال حافلة",

  // نظرة عامة على الحافلة (عند فتح صف من صفوف الأسطول)
  "fleet.title": "نظرة عامة على {bus}",
  "fleet.titleNoBus": "نظرة عامة على الحافلة",
  "fleet.openAria": "فتح نظرة عامة على {bus}",
  "fleet.sectionOnboard": "على المتن",
  "fleet.sectionDropped": "تم توصيلهم",
  "fleet.sectionAbsent": "غائب",
  "fleet.absentHint": "غائب عن هذه الرحلة",
  "fleet.emptyTitle": "لا يوجد طلاب في هذه الرحلة",
  "fleet.emptyBody": "لم يُسجَّل أي حضور على هذه الحافلة لهذه الرحلة بعد.",
  "fleet.searchAria": "البحث عن طلاب هذه الحافلة",
  "fleet.searchPlaceholder": "ابحث عن طالب",
  "fleet.searchMatches": "{shown} من {total} طالباً",
  "fleet.searchEmptyTitle": "لا يوجد طلاب يطابقون هذا البحث",
  "fleet.searchEmptyBody": "جرّب اسماً آخر أو امسح البحث.",

  // Student list (dashboard) — search, filters, and pagination
  "studentList.searchAria": "بحث عن الطلاب",
  "studentList.searchPlaceholder": "ابحث عن اسم الطالب…",
  "studentList.statusAria": "تصفية حسب الحالة",
  "studentList.gradeAria": "تصفية حسب الصف",
  "studentList.allGrades": "كل الصفوف",
  "studentList.clear": "مسح التصفية",
  // داخل قائمة منسدلة طويلة بما يكفي للبحث عن قيمة.
  "dropdown.searchPlaceholder": "ابحث…",
  "dropdown.searchEmpty": "لا توجد نتائج",
  "pagination.showing": "عرض {start}–{end} من {total}",
  "studentList.previousAria": "الصفحة السابقة",
  "studentList.nextAria": "الصفحة التالية",
  "pagination.navAria": "التنقل بين الصفحات",
  "pagination.previous": "الصفحة السابقة",
  "pagination.next": "الصفحة التالية",
  "pagination.pageNumber": "الصفحة {page}",

  // KPI cells — labels are nouns, footers are computed captions
  "kpi.total.label": "المخصصون",
  "kpi.total.footer": "عبر {count} مسارات",
  "kpi.total.footer.one": "عبر {count} مسار",
  "kpi.onboard.label": "على المتن",
  "kpi.onboard.footer": "{percent}٪ من المخصصين",
  "kpi.dropped.label": "تم توصيلهم",
  "kpi.dropped.footer": "{percent}٪ من المخصصين",
  "kpi.absent.label": "لم يُتحقق منهم",
  "kpi.absent.footer": "{absent} غائب · {unrecorded} بلا سجل",

  // Roles
  "role.director": "مدير",
  "role.operator": "مشغّل",
  "role.mainDirector": "المدير الرئيسي",
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
  "settings.appearance": "المظهر",
  "settings.language": "اللغة",
  "settings.signOut": "تسجيل الخروج",

  // Help dialog
  "help.title": "المساعدة",
  "help.content":
    "تعرض لوحة التحكم حالة الحافلات الحية والرحلات وإجماليات اليوم.\nاستخدم عنصر التحكم في نوع الرحلة للتبديل بين الاستلام الصباحي والتوصيل المسائي.\nاختر تاريخاً لعرض يوم سابق.\nالإرسال ينشئ رحلة جديدة ويسجل طلابها.\nقسم الطلاب يعرض سجل المدرسة وسجل كل طالب.\nالتصدير ينزّل الصفوف المفلترة الحالية كملف CSV.",

  // Guidebook — the manual behind the tour. One page per screen, filtered by
  // what the reader can open (see src/lib/guide.ts).
  "guide.title": "الدليل",
  "help.openGuide": "افتح الدليل",
  "guide.lead": "كيف تعمل كل شاشة، صفحة واحدة في كل مرة.",
  "guide.contents": "الصفحات",
  "guide.searchAria": "البحث في الدليل",
  "guide.searchPlaceholder": "ابحث في الدليل",
  "guide.searchEmpty": "لا توجد صفحة تذكر «{term}».",
  "guide.lockedLabel": "ليست لك",
  "guide.lockedHint":
    "يمكن للمدير منح الشاشة من صفحة المشغّلين. والدليل يشرحها في كل الأحوال.",
  "guide.lockedTitle": "ليست لك",
  "guide.lockedBody":
    "لا يفتح حسابك هذه الصفحة إلا بعد أن يمنحها مدير. وما يلي هو ما تفعله الصفحة.",
  "guide.stepsHeading": "كيف تعمل",
  "guide.wordsHeading": "كلمات هذه الشاشة",
  "guide.replayTour": "أرِني الجولة",
  "guide.previous": "السابق",
  "guide.next": "التالي",
  "guide.pickerLabel": "الصفحة",

  // Guidebook — one section per screen. Titles reuse the nav keys.
  "guide.live.tldr":
    "جواب اليوم: من على الحافلة، ومن نزل، ومن لم يسجّل أحد عنه شيئاً بعد.",
  "guide.live.caption": "كتلة «تم التحقق منهم»، وصف مسار واحد، والأرقام خلفه.",
  "guide.live.s1.title": "ابدأ بجواب اليوم",
  "guide.live.s1.body":
    "«تم التحقق منهم» رقم واحد: الطلاب ذوو الحالة المسجّلة، من بين كل من خُصص لهذه الرحلة.",
  "guide.live.s2.title": "افتح مساراً",
  "guide.live.s2.body":
    "يفتح صف المسار ورقة تلك الحافلة، وفيها كل طفل بالترتيب الذي نزل به.",
  "guide.live.s3.title": "راقب الرحلات التي ما زالت تسير",
  "guide.live.s3.body":
    "تُغلق الرحلة عندما ينهيها السائق. والرحلة المغلقة التي بقي فيها أطفال بلا سجل هي التي تحتاج اتصالاً.",
  "guide.live.w1.meaning":
    "الطلاب ذوو الحالة المسجّلة، من بين من خُصصوا للرحلة.",
  "guide.live.w2.meaning":
    "الاستلام الصباحي والتوصيل المسائي رحلتان بقائمتين؛ واليوم هو الاثنتان معاً.",

  "guide.students.tldr": "سجل المدرسة كاملاً، وسجل الطفل الواحد عند الحاجة.",
  "guide.students.caption": "بلا تاريخ: السجل كاملاً، مع حضور كل طفل خلال المدة.",
  "guide.students.s1.title": "بلا تاريخ تعني السجل كاملاً",
  "guide.students.s1.body":
    "اترك التاريخ فارغاً لترى كل طفل: أيام الحضور، وأيام الغياب، ونسبة الحضور، وآخر يوم مسجّل خلال آخر 90 يوماً.",
  "guide.students.s2.title": "اختر يوماً لأعمدة الرحلة",
  "guide.students.s2.body":
    "مع تاريخ، تعرض الصفوف نفسها وقت الركوب، ووقت التوصيل، وترتيب النزول، والحالة.",
  "guide.students.s3.title": "افتح سجل الطفل",
  "guide.students.s3.body": "صف لكل رحلة، الأحدث أولاً، عن الأيام التي ما زالت المدرسة تحتفظ بها.",
  "guide.students.w1.term": "السجل",
  "guide.students.w1.meaning": "كل طفل في المدرسة، أياً كان ما حدث اليوم.",
  "guide.students.w2.term": "ترتيب النزول",
  "guide.students.w2.meaning":
    "مكان نزول الطفل من الحافلة، مرقّماً 1 و2 و3 في ورقة تلك الحافلة.",

  "guide.reports.tldr": "اليوم نفسه، محسوباً بالصف بدل الحافلة.",
  "guide.reports.caption":
    "التقارير: اليوم والرحلة في الأعلى، وبطاقة صف واحدة، والطريق إلى التحليلات.",
  "guide.reports.s1.title": "حدّد اليوم والرحلة",
  "guide.reports.s1.body":
    "للتقارير تاريخها الخاص؛ تغييره هنا لا يحرّك المراقب المباشر ولا الطلاب.",
  "guide.reports.s2.title": "اقرأ بطاقات الصفوف",
  "guide.reports.s2.body": "كل بطاقة صف واحد في ذلك اليوم: الحاضر، والغائب، ونسبة الحضور.",
  "guide.reports.s3.title": "قارن الحافلات",
  "guide.reports.s3.body":
    "ترسم التحليلات الرحلات المكتملة لكل حافلة أعمدةً أو حلقة: تصميمان للأرقام نفسها.",
  "guide.reports.w1.term": "نسبة الحضور",
  "guide.reports.w1.meaning":
    "أيام الحضور من الأيام المسجّلة في المدة، لا من أيام التقويم.",
  "guide.reports.w2.term": "رحلة مكتملة",
  "guide.reports.w2.meaning": "رحلة أنهىها السائق. لا تُقارن إلا الرحلات المكتملة.",

  "guide.assignments.tldr":
    "أي حافلة يركبها كل طفل: واحداً واحداً، أو ورقة كاملة دفعة واحدة.",
  "guide.assignments.caption": "التصفية، ومحدّد حافلة طالب واحد، واستيراد الورقة.",
  "guide.assignments.s1.title": "ضيّق القائمة أولاً",
  "guide.assignments.s1.body":
    "ابحث بالاسم، أو صفِّ بالحافلة والصف. يخبرك السطر فوق الجدول بعدد الطلاب الذين تنظر إليهم.",
  "guide.assignments.s2.title": "حرّك طفلاً واحداً",
  "guide.assignments.s2.body":
    "يحفظ محدّد الحافلة فور اختيارك، ويعرض الصف الحافلة الجديدة دون انتظار إعادة القراءة.",
  "guide.assignments.s3.title": "حرّك ورقة كاملة",
  "guide.assignments.s3.body":
    "أفلت ملف CSV أو XLSX، وتحقّق من مطابقة الأعمدة والمعاينة، ثم طبّق. تُبلَّغ الصفوف غير المطابقة ولا تُسقَط.",
  "guide.assignments.import": "استيراد ورقة",
  "guide.assignments.w1.term": "وضع التعيين",
  "guide.assignments.w1.meaning":
    "هل يُسمّى العمود بالحافلة أم بالسائق. إنه إعداد المدرسة، فيقرأ الزملاء الجواب نفسه.",
  "guide.assignments.w2.term": "صف غير مطابق",
  "guide.assignments.w2.meaning":
    "سطر لم يستطع الاستيراد ربطه بطالب. لا يُكتب له شيء.",

  "guide.drivers.tldr": "حسابات السائقين ورموز الدخول المكوّنة من ستة أرقام.",
  "guide.drivers.caption": "السائقون: إنشاء حساب، ثم توليد رمز ونسخه وهو معروض.",
  "guide.drivers.s1.title": "أنشئ السائق",
  "guide.drivers.s1.body":
    "الاسم يكفي. ينشئ الـAPI الحساب، ويُصدر الرمز الأول معه.",
  "guide.drivers.s2.title": "انسخ الرمز الآن",
  "guide.drivers.s2.body":
    "تُخزَّن الرموز مشفّرة. يظهر النص الصريح مرة واحدة في الصف، ومغادرة الصفحة تفقده.",
  "guide.drivers.s3.title": "أعد التوليد إذا انتشر",
  "guide.drivers.s3.body":
    "يستبدل الرمز الجديد القديم فوراً، ويتوقف عمل الرمز القديم.",
  "guide.drivers.w1.term": "رمز الدخول",
  "guide.drivers.w1.meaning": "ستة أرقام يكتبها السائق بدل البريد وكلمة المرور.",
  "guide.drivers.w2.meaning":
    "يصدر رمزاً جديداً يحل محل القديم فوراً ولا يمكن الرجوع إليه لاحقاً.",

  "guide.operators.tldr": "امنح موظفي المكتب الشاشات التي يحتاجها عملهم، ولا شيء أكثر.",
  "guide.operators.caption":
    "المشغّلون: شخص واحد، والشاشات المؤشَّرة على حسابه، والحفظ.",
  "guide.operators.s1.title": "أضف الشخص",
  "guide.operators.s1.body":
    "الاسم والبريد وكلمة مرور مؤقتة. لا يوجد الحساب إلا بعد أن ينشئه الـAPI.",
  "guide.operators.s2.title": "أشّر الشاشات",
  "guide.operators.s2.body":
    "كل تأشيرة صلاحية حقيقية تفرضها قواعد الأمان والـAPI، لا رابطاً مخفياً.",
  "guide.operators.s3.title": "غيّر الوصول أو أزله",
  "guide.operators.s3.body":
    "يسري التعديل عند القراءة التالية. وإزالة الوصول تغلق الشاشات التي لم يعد الحساب يملكها.",
  "guide.operators.w1.meaning":
    "المدير الوحيد الذي يفتح المشغّلين. والمدرسة ذات المدير الواحد تُعامل كأن لها مديراً رئيسياً.",
  "guide.operators.w2.term": "منح",
  "guide.operators.w2.meaning":
    "شاشة مؤشَّرة على حساب مشغّل. وغير المؤشَّرة تعني أن الصفحة ليست له.",

  "guide.legend.title": "دليل الحالات",
  "guide.legend.tldr": "ما تعنيه الألوان والأرقام في هذا المراقب.",
  "guide.legend.caption":
    "ثلاث حالات مسجّلة، والحالة المحايدة، وترتيب النزول.",
  "guide.legend.s1.title": "التلوين هو الحالة",
  "guide.legend.s1.body":
    "الأخضر على الحافلة، والأزرق نزل عنها، والأحمر غياب مسجّل. والتسمية تقولها أيضاً، فلا يكون اللون حاملاً وحيداً.",
  "guide.legend.s2.title": "عمود النزول هو الترتيب",
  "guide.legend.s2.body":
    "داخل الحافلة، الأرقام هي ترتيب نزول الأطفال؛ وآخر رقم يغلق التسلسل.",
  "guide.legend.s3.title": "«غير محتسب» ليست حالة",
  "guide.legend.s3.body":
    "الطفل بلا سجل لا حالة له. يُقرأ عدداً محايداً، لا تحذيراً بجوار طفل غائب.",
  "guide.legend.w1.term": "مسجّل",
  "guide.legend.w1.meaning": "طفل ضغط عليه السائق. لا شيء آخر يُحتسب حضوراً.",
  "guide.legend.w2.term": "مدة الاحتفاظ",
  "guide.legend.w2.meaning": "آخر 90 يوماً يلخّصها السجل. ولا يُحتسب الغياب خارجها.",

  // Dashboard tour — the invite, then one card per control (src/lib/tour.ts).
  "tour.invite.title": "أتحب جولة سريعة؟",
  "tour.invite.body": "جولة في شاشات المراقب، نحو دقيقتين. توقّف متى شئت.",
  "tour.invite.start": "أرِني الجولة",
  "tour.invite.later": "ليس الآن",
  "tour.stepOf": "الخطوة {current} من {total}",
  "tour.back": "السابق",
  "tour.next": "التالي",
  "tour.finish": "تم",
  "tour.skip": "تخطّي الجولة",
  "tour.close": "إغلاق الجولة",
  "tour.step.nav.title": "صفحاتك",
  "tour.step.nav.body":
    "كل شاشة يفتحها هذا الحساب. والصفحة غير الممنوحة ليست هنا أصلاً.",
  "tour.step.scope.title": "اليوم والرحلة",
  "tour.step.scope.body":
    "اختر يوماً، أو بدّل بين الاستلام الصباحي والتوصيل المسائي. كل شاشة تتذكر يومها.",
  "tour.step.summary.title": "جواب اليوم",
  "tour.step.summary.body":
    "كم طفلاً تم التحقق منه من بين كل المخصصين. وكل ما في هذه الصفحة طريق إلى هذا الرقم.",
  "tour.step.routes.title": "صف واحد، حافلة واحدة",
  "tour.step.routes.body":
    "يفتح صف المسار تلك الحافلة: تقدمها، ومن على المتن، وكل طفل بترتيب نزوله.",
  "tour.step.actions.title": "أرسل أو صدّر",
  "tour.step.actions.body":
    "الإرسال ينشئ رحلة ويسجّل طلابها مسبقاً. والتصدير يكتب صفوف اليوم ملف CSV.",
  "tour.step.guide.title": "الدليل وهذه الجولة",
  "tour.step.guide.body":
    "يشرح الدليل كل شاشة، وفي «المساعدة» البابان، وهذا الصف يعيد الجولة متى شئت.",
  "tour.step.studentsRoll.title": "سجل المدرسة",
  "tour.step.studentsRoll.body":
    "كل طفل، أياً كان ما حدث اليوم. وبلا تاريخ محدد، يلخّص كل صف آخر 90 يوماً بدل رحلة واحدة.",
  "tour.step.studentsToolbar.title": "ضيّق القائمة",
  "tour.step.studentsToolbar.body":
    "ابحث بالاسم، أو صفِّ بالصف والحالة، ورتّب بترتيب الرحلة في اليوم أو بالاسم في السجل.",
  "tour.step.studentsHistory.title": "سجل الطفل",
  "tour.step.studentsHistory.body":
    "يفتح كل صف أيام ذلك الطفل المسجّلة، صفاً لكل رحلة، الأحدث أولاً. ولا يُعدَّل شيء من هنا.",
  "tour.step.reportsOverview.title": "اليوم، محسوباً",
  "tour.step.reportsOverview.body":
    "الرحلات نفسها التي في المراقب، محسوبة لا مسرودة: إجماليات اليوم، ثم صف لكل حافلة ونسبة إكمالها.",
  "tour.step.reportsClasses.title": "أي صف يحتاج انتباهاً",
  "tour.step.reportsClasses.body":
    "بطاقة لكل صف فيها الحاضر والغائب ونسبة الحضور. والتحليلات بجوار العنوان تقارن الحافلات.",
  "tour.step.assignmentsStudents.title": "حرّك طفلاً",
  "tour.step.assignmentsStudents.body":
    "اختر حافلة في الصف فيُحفظ النقل فوراً. والمبدّل فوق القائمة يسمّي كل صف بالحافلة أو بالسائق.",
  "tour.step.assignmentsImport.title": "حرّك ورقة كاملة",
  "tour.step.assignmentsImport.body":
    "أفلت ملف CSV أو XLSX، وتحقّق من مطابقة الأعمدة والمعاينة، ثم طبّق. تُبلَّغ الصفوف غير المطابقة ولا تُسقَط.",
  "tour.step.driversAdd.title": "أنشئ السائق",
  "tour.step.driversAdd.body":
    "الاسم يكفي. ينشئ الـAPI الحساب ويُصدر الرمز الأول معه، فلا شيء آخر يُضبط.",
  "tour.step.driversCodes.title": "انسخ الرمز الآن",
  "tour.step.driversCodes.body":
    "يظهر الرمز مرة واحدة. وإعادة التوليد تستبدله فوراً ويتوقف القديم، فانسخه وهو معروض.",
  "tour.step.operators.title": "وصول المكتب",
  "tour.step.operators.body":
    "أشّر الشاشات التي يحتاجها عمل المشغّل ولا شيء أكثر. كل تأشيرة صلاحية حقيقية تفرضها القواعد والـAPI.",


  // Hover hints — one title and one sentence, shown after a 3s dwell on a control
  // (src/components/HoverHint.tsx). Any element can carry `data-hint="<id>"`.
  "hint.scope.title": "اليوم والرحلة",
  "hint.scope.body":
    "يحدد التاريخ ونوع الرحلة لهذه الشاشة وحدها. وتحتفظ شاشة أخرى بيومها.",
  "hint.summary.title": "تم التحقق منهم",
  "hint.summary.body":
    "الطلاب ذوو الحالة المسجّلة اليوم، من بين كل المخصصين لهذه الرحلة.",
  "hint.unaccounted.title": "غير محتسب",
  "hint.unaccounted.body":
    "الطلاب بلا سجل اليوم، مع من سُجّل غائباً. عدد فقط، لا تحذير بحد ذاته.",
  "hint.routes.title": "المسارات",
  "hint.routes.body":
    "كل صف حافلة واحدة. افتحه لترى أطفال تلك الرحلة وترتيب نزولهم.",
  "hint.dispatch.title": "إرسال حافلة",
  "hint.dispatch.body":
    "ينشئ رحلة لحافلة ويوم ونوع، ويسجّل طلاب تلك الحافلة عليها مسبقاً.",
  "hint.export.title": "تصدير CSV",
  "hint.export.body":
    "ينزّل كل صفوف نوع الرحلة المحدد، لا ما يظهر على الشاشة فقط.",
  "hint.guidebook.title": "الدليل",
  "hint.guidebook.body":
    "صفحة لكل شاشة: ما تجيب عنه، وكيف تستخدمها، والكلمات التي تستخدمها.",
  "hint.date.title": "التاريخ",
  "hint.date.body":
    "اتركه فارغاً لقراءة السجل كاملاً. واختر يوماً لترى رحلات ذلك اليوم بدلاً منه.",

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
  "analytics.chartDesign": "تصميم المخطط",
  "analytics.chartBar": "أعمدة",
  "analytics.chartDonut": "حلقي",
  "analytics.chartCompleted": "الرحلات المكتملة",
  "analytics.studentsUnit": "طالب",
  "analytics.fleetAverage": "متوسط الأسطول",
  "analytics.averageShort": "متوسط",
  "analytics.noData": "لا توجد بيانات",
  "analytics.emptyTitle": "لا توجد بيانات حضور",
  "analytics.emptySubtitle": "لا توجد سجلات لهذا التاريخ ونوع الرحلة بعد.",

  // Reports
  "reports.title": "تقرير الحضور",
  "reports.analytics": "التحليلات",
  "reports.overview": "نظرة عامة",
  "reports.byBus": "الملخص حسب الحافلة",
  "reports.print": "طباعة",
  "reports.export": "تصدير CSV",
  "reports.emptyTitle": "لا توجد بيانات حضور",
  "reports.emptySubtitle": "لا توجد سجلات لهذا التاريخ ونوع الرحلة بعد.",

  // Assignments (director — driver ↔ bus, student ↔ bus)
  "assignments.title": "التعيينات",
  "assignments.subtitle": "تعيين السائقين والطلاب للحافلات",
  "assignments.modeAria": "عرض كل طالب حسب الحافلة أو حسب السائق",
  "assignments.byBus": "حسب الحافلة",
  "assignments.byDriver": "حسب السائق",
  "assignments.busesEmpty": "لم تُضبط أي حافلات بعد.",
  "assignments.drivers": "السائقون",
  "assignments.th.bus": "الحافلة",
  "assignments.th.driver": "السائق المعيّن",
  "assignments.th.assignedStudents": "الطلاب المعيّنون",
  "assignments.unassigned": "—",
  "assignments.students": "الطلاب",
  "assignments.th.studentName": "اسم الطالب",
  "assignments.th.grade": "الصف",
  "assignments.th.currentBus": "الحافلة الحالية",
  "assignments.th.currentDriver": "السائق الحالي",
  "assignments.busWithoutDriver": "{bus} · بدون سائق",
  "assignments.noBus": "لا توجد حافلة",
  "assignments.studentsEmpty": "لا يوجد طلاب",
  "assignments.studentsEmptyHint": "عدّل البحث أو حمّل المزيد من الطلاب.",
  "assignments.filterBusAria": "تصفية الطلاب حسب الحافلة",
  "assignments.filterDriverAria": "تصفية الطلاب حسب السائق",
  "assignments.filterGradeAria": "تصفية الطلاب حسب الصف",
  "assignments.allBuses": "كل الحافلات",
  "assignments.filteredCount": "{shown} من {total} طالبًا",
  "assignments.filterEmpty": "لا يوجد طلاب مطابقون لهذه التصفية",
  "assignments.filterEmptyHint": "اختر حافلة أو صفًا آخر، أو امسح التصفية.",
  "assignments.loadingStudents": "جارٍ تحميل الطلاب…",
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
  "drivers.searchAria": "البحث عن سائق",
  "drivers.searchPlaceholder": "ابحث باسم السائق…",
  "drivers.searchEmptyTitle": "لا يوجد سائقون يطابقون هذا البحث",
  "drivers.searchEmptyBody": "جرّب اسماً آخر أو امسح البحث.",
  "drivers.newCodeTitle": "تم إنشاء السائق",
  "drivers.newCodeBody": "رمز الوصول لـ {name}:",
  "drivers.codeOnceHint": "انسخه الآن — لن يُعرض هذا الرمز مرة أخرى.",
  "drivers.copied": "تم نسخ الرمز",
  "drivers.copyError": "تعذّر نسخ الرمز",
  "drivers.createdToast": "تم إنشاء حساب السائق",
  "drivers.codeIssuedToast": "رمز جديد لـ {name} — انسخه الآن",
  "drivers.generateError": "تعذّر توليد الرمز. حاول مرة أخرى.",
  "drivers.generateOffline":
    "تعذّر الوصول إلى خادم المدرسة. تحقّق من الاتصال وحاول مرة أخرى.",
  "drivers.createError": "تعذّر إنشاء السائق. حاول مرة أخرى.",

  // المشغّلون (المدير الرئيسي — من يفتح ماذا)
  "operators.title": "المشغّلون",
  "operators.subtitle": "امنح موظفي المكتب الشاشات التي يحتاجها عملهم، ولا شيء أكثر.",
  "operators.create": "إضافة مشغّل",
  "operators.directors": "المديرون",
  "operators.directorsHint":
    "المدير يفتح كل الشاشات. المدير الرئيسي وحده يستطيع تعديل هذه الصفحة.",
  "operators.operators": "المشغّلون",
  "operators.operatorsHint": "كل شخص يفتح الشاشات المحددة في حسابه فقط.",
  "operators.empty": "لا يوجد مشغّلون بعد",
  "operators.emptyHint":
    "أضف زميلًا لتمنحه جزءًا من لوحة التحكم دون تسليم المدرسة كلها.",
  "operators.screensLabel": "الشاشات",
  "operators.screen.live": "المراقب المباشر",
  "operators.screen.students": "الطلاب",
  "operators.screen.reports": "التقارير",
  "operators.screen.assignments": "التعيينات",
  "operators.screen.drivers": "السائقون",
  "operators.edit": "تعديل الوصول",
  "operators.remove": "إلغاء الوصول",
  "operators.removeConfirmTitle": "إلغاء الوصول؟",
  "operators.removeConfirmBody":
    "سيتم تسجيل خروج {name} ولن يستطيع فتح لوحة التحكم. يمكنك إضافته مرة أخرى لاحقًا.",
  "operators.newTitle": "إضافة مشغّل",
  "operators.editTitle": "وصول {name}",
  "operators.nameLabel": "الاسم الكامل",
  "operators.namePlaceholder": "مثال: منى فرح",
  "operators.emailLabel": "البريد الإلكتروني",
  "operators.emailPlaceholder": "name@school.edu",
  "operators.passwordLabel": "كلمة مرور مؤقتة",
  "operators.passwordHint":
    "١٢ حرفًا على الأقل، مع حروف كبيرة وصغيرة ورقم ورمز. التطبيق لا يرسلها بالبريد.",
  "operators.newPasswordLabel": "كلمة مرور جديدة (اختياري)",
  "operators.newPasswordHint":
    "اتركها فارغة للإبقاء على كلمة المرور الحالية. لن تُعرض مرة أخرى.",
  "operators.showPassword": "إظهار كلمة المرور",
  "operators.hidePassword": "إخفاء كلمة المرور",
  "operators.generate": "توليد",
  "operators.pw.length": "١٢ حرفًا أو أكثر",
  "operators.pw.upper": "حرف كبير واحد",
  "operators.pw.lower": "حرف صغير واحد",
  "operators.pw.digit": "رقم واحد",
  "operators.pw.symbol": "رمز واحد",
  "operators.pw.progress": "{met} من {total} من الشروط مستوفاة",
  "operators.passwordWeak": "كلمة المرور لم تستوفِ كل الشروط بعد.",
  "operators.passwordChanged": "تم تغيير كلمة المرور",
  "operators.passwordError": "تعذّر تغيير كلمة المرور. حاول مرة أخرى.",
  "operators.createdTitle": "تمت إضافة المشغّل",
  "operators.createdBody": "يدخل {name} بهذه البيانات.",
  "operators.passwordRow": "كلمة المرور",
  "operators.copyPassword": "نسخ كلمة المرور",
  "operators.copied": "تم النسخ",
  "operators.copyError": "تعذّر نسخ كلمة المرور",
  "operators.credentialsHint":
    "تُعرض مرة واحدة — سلّمها الآن. يمكنك تعيين كلمة جديدة من القائمة في أي وقت.",
  "operators.screensHint": "حدّد ما يحتاجه عمله فقط.",
  "operators.createAction": "إنشاء الحساب",
  "operators.save": "حفظ الشاشات",
  "operators.created": "تمت إضافة المشغّل",
  "operators.saved": "تم تحديث الشاشات",
  "operators.removed": "تم إلغاء الوصول",
  "operators.emailTaken": "هذا البريد الإلكتروني مرتبط بحساب آخر.",
  "operators.createError": "تعذّرت إضافة المشغّل. حاول مرة أخرى.",
  "operators.updateError": "تعذّر تحديث الشاشات. حاول مرة أخرى.",
  "operators.removeError": "تعذّر إلغاء الوصول. حاول مرة أخرى.",
  "operators.screensRequired": "اختر شاشة واحدة على الأقل.",
  "operators.selfTag": "أنت",
  "operators.ownerTag": "المدير الرئيسي",

  // Common
  "common.changeLanguageAria": "تغيير اللغة",

  // المظهر (الوضع الداكن)
  "theme.aria": "المظهر",
  "theme.system": "النظام",
  "theme.light": "فاتح",
  "theme.dark": "داكن",
  "theme.toggleToDark": "التبديل إلى المظهر الداكن",
  "theme.toggleToLight": "التبديل إلى المظهر الفاتح",
  "common.loading": "جارٍ التحميل",

  // رمز وصول السائق — إدخال من ست خانات وحالة التحقق
  "login.codeDigitAria": "{label} — الرقم {index} من {total}",
  "login.codeChecking": "جارٍ التحقق من الرمز…",
  "login.codeVerified": "تم التحقق من الرمز",
  "login.codeVerifiedHint": "جارٍ تسجيل الدخول…",
  "login.networkError":
    "تعذّر الوصول إلى خادم المدرسة. تحقّق من الاتصال وحاول مرة أخرى.",
  "login.serverError": "حدثت مشكلة في خادم المدرسة. حاول مرة أخرى بعد قليل.",

  // ── الطلاب: سجل المدرسة في قسمه الخاص ─────────────────────────────────────
  "students.title": "الطلاب",
  "students.subtitle": "{school} · {count} في السجل · {classes} صفوف",
  "students.roll": "سجل الطلاب",
  "students.meta": "{count} طالبًا · {sort}",
  "students.meta.one": "{count} طالب · {sort}",
  "students.retention": "يُحفظ السجل ٩٠ يومًا",
  "students.add": "إضافة طالب",
  "students.addHint": "تُضاف الطلاب من شاشة التعيينات",
  "students.sortAria": "ترتيب الطلاب",
  "students.sort.runOrder": "ترتيب الرحلة",
  "students.sort.name": "الاسم أ–ي",
  "students.sort.grade": "الصف",
  "students.off": "النزول",
  "students.offAria": "الترتيب في رحلة التوصيل",
  // سجل الطلاب دون تحديد يوم: كل طالب وملخّص حضوره خلال المدة.
  "students.allStudents": "كل الطلاب",
  "students.th.present": "حاضر",
  "students.th.absent": "غائب",
  "students.th.attendance": "نسبة الحضور",
  "students.th.lastRecord": "آخر سجل",
  "students.presentTitle": "الأيام التي سُجّل فيها الحضور خلال آخر {days} يومًا",
  "students.absentTitle": "الأيام المسجّلة غيابًا خلال آخر {days} يومًا",
  "students.attendanceTitle": "أيام الحضور من الأيام المسجّلة",
  "students.range": "آخر {days} يومًا",
  "students.noRecord": "لا سجلات",
  "students.rollCaption":
    "كل طالب في السجل، مع حضوره خلال آخر {days} يومًا",
  "students.phonePresence": "حضور {present} · غياب {absent} · {percent}٪",
  "students.phoneLastRecord": "آخر سجل {date}",
  "students.emptyRollTitle": "لا يوجد طلاب في السجل",
  "students.emptyRollSubtitle": "أضف الطلاب من شاشة التعيينات.",
  "students.noMatchTitle": "لا يوجد طلاب مطابقون لهذه التصفية",
  "students.noMatchSubtitle": "جرّب اسمًا آخر، أو امسح التصفية.",

  // ── ورقة الحافلة الواحدة (ترتيب التوصيل هنا) ─────────────────────────────
  "busDetail.hint": "{driver} · {count} طالبًا · {percent}٪ مكتمل",
  "busDetail.hint.one": "{driver} · {count} طالب · {percent}٪ مكتمل",
  "busDetail.offColumn": "النزول",
  "busDetail.caption": "{bus}: الطلاب بترتيب نزولهم من الحافلة",
  "busDetail.foot": "{off} من {total} نزلوا · أول نزول {time}",
  "busDetail.openInStudents": "فتح في الطلاب",
  "busDetail.unaccounted": "غير محتسب",

  // ── التقارير: الصفوف بطاقات ──────────────────────────────────────────────
  "reports.classes": "الصفوف",
  "reports.classesMeta": "{classes} صفوف · {students} طالبًا",
  "reports.sortAria": "ترتيب الصفوف",
  "reports.sort.grade": "الصف أ–ي",
  "reports.sort.absent": "الأكثر غيابًا",
  "reports.sort.completion": "الأقل إكمالًا",
  "reports.sort.size": "الأكثر طلابًا",
  "reports.allClasses": "كل الصفوف",
  "reports.classSearchPlaceholder": "ابحث عن صف…",
  "reports.classSearchEmpty": "لا يوجد صف بهذا الاسم.",
  "reports.openClassHint": "اضغط على صف لعرض طلابه.",
  "reports.classCount": "{count} طالبًا",
  "reports.classCountOne": "{count} طالب",
  "reports.classCompletion": "{percent}٪ من الرحلة مكتمل",
  "reports.classCaption": "طلاب {grade}، بترتيب الاسم",
  "sheet.title": "استيراد ورقة",
  "sheet.template": "تنزيل القالب",
  "sheet.import": "استيراد ورقة",
  "sheet.dropTitle": "أفلت قائمة الصف هنا",
  "sheet.dropDesc": "أو اختر ملف CSV أو Excel — ورقة واحدة، حتى ١٠ ميغابايت",
  "sheet.dropNote": "تُطابَق الأعمدة تلقائيًا. لا يُكتب شيء قبل التأكيد.",
  "sheet.ready": "جاهز للمطابقة",
  "sheet.matchColumns": "مطابقة الأعمدة",
  "sheet.mappingTitle": "طابِق الأعمدة",
  "sheet.mappingHint": "{file} · {sheet} · قُرئ {rows} صفًا",
  "sheet.whereEachColumn": "إلى أين يذهب كل عمود",
  "sheet.whereEachColumnHint": "طابقنا {matched} من {total} أعمدة. غيّر أيًّا منها قبل التطبيق.",
  "sheet.columnLetter": "العمود {letter}",
  "sheet.matchedOn": "طُوبق على {name}",
  "sheet.notMatched": "غير مطابق",
  "sheet.field.studentName": "اسم الطالب",
  "sheet.field.grade": "الصف",
  "sheet.field.bus": "الحافلة",
  "sheet.field.ignore": "تجاهل",
  "sheet.previewTitle": "معاينة — أول {shown} من {total} صفًا",
  "sheet.previewNote": "تُعرض الصفوف غير المطابقة بعد التطبيق — لا تخمين.",
  "sheet.resultMove": "{count} طالبًا ينتقلون إلى حافلة أخرى",
  "sheet.resultUnchanged": "{count} مطابق أصلًا",
  "sheet.resultUnmatched": "{count} صفًا بلا طالب مطابق",
  "sheet.apply": "تطبيق {count} نقلًا",
  "sheet.nothingWritten": "لا يُكتب شيء قبل التطبيق.",
  "sheet.back": "رجوع",
  "sheet.imported": "تم استيراد {count} تعيينًا",
  "sheet.unreadable": "تعذّرت قراءة الملف. احفظه بصيغة CSV أو مصنّف Excel.",
  "sheet.dz.files": "الملفات",
  "sheet.dz.remove": "إزالة {name}",
  "sheet.dz.retry": "إعادة المحاولة",
  "sheet.dz.uploading": "جارٍ الرفع",
  "sheet.dz.uploaded": "تم الرفع",
  "sheet.dz.uploadFailed": "تعذّرت قراءة الملف",
  "sheet.dz.failed": "فشل:",
  "sheet.dz.wrongTypeOne": "{name} ليس من نوع ملف مقبول.",
  "sheet.dz.wrongTypeMany": "لم تُضف بعض الملفات: نوعها غير مقبول.",
  "sheet.dz.tooMany": "يمكنك إضافة {count} ملفات كحد أقصى.",
  "sheet.dz.dropOne": "أفلت لإضافة الملف",
  "sheet.dz.dropMany": "أفلت لإضافة الملفات",

  // ── السجل: اختيار اليوم من التقويم ───────────────────────────────────────
  "history.daysWithRecords": "{count} يومًا بسجلات في {month}",
  "history.dayWithRecords": "يوم بسجلات",
  "history.noRecordsLegend": "بلا سجلات",
  "history.schoolDays": "{have} من {total} أيام دراسية",
  "history.notStarted": "لم يبدأ بعد",
  "history.recordedByDriver": "سجّله تطبيق السائق",
  "history.dayOpen": "سجل هذا اليوم ما زال مفتوحًا — لم تبدأ رحلة العصر.",
  "history.previousMonth": "الشهر السابق",
  "history.nextMonth": "الشهر التالي",

  // ── سجل النشاط ──────────────────────────────────────────────────────────
  "nav.activity": "النشاط",
  "guide.activity.tldr":
    "كل تغيير في المدرسة، بالترتيب، مع من قام به — ولا سبيل لتعديله بعد ذلك.",
  "guide.activity.caption": "العدّادات الخمسة هي أيضًا عامل التصفية؛ وكل صف يُفتح ليعرض ما قبل وما بعد.",
  "guide.activity.s1.title": "العدّادات أولًا",
  "guide.activity.s1.body":
    "يخبرك الشريط بما حدث قبل أن تقرأ شيئًا: كم كان من تغييرات الوصول، وكم من الكشف، وكم من إعدادات المدرسة.",
  "guide.activity.s2.title": "الأحدث أولًا دائمًا",
  "guide.activity.s2.body":
    "تُرتَّب الصفوف حسب وصولها إلى خادم المدرسة. أما النقرة على حافلة بلا إشارة فتُسجَّل عند وصولها أخيرًا — ويحمل المُدخل وقت الجهاز أيضًا، ويظهر أسفل الصف.",
  "guide.activity.s3.title": "افتح صفًا",
  "guide.activity.s3.body":
    "يتوسّع الصف ليعرض الحقول التي تغيّرت، قبل وبعد، ومصدر المُدخل — الخادم أو المتصفح.",
  "guide.activity.w1.term": "سجّله المتصفح",
  "guide.activity.w1.meaning":
    "كُتب التغيير ومُدخله معًا، ومنسوبًا إلى من قام به. لا يمكن تعديل المُدخل، لكن قيمه هي ما أبلغ عنه جهاز ذلك الشخص.",
  "guide.activity.w2.term": "سجّله الخادم",
  "guide.activity.w2.meaning":
    "حدث حساب أو دخول، كتبه خادم المدرسة من جلسة موثّقة — وهو النصف الأقوى من السجل.",
  "guide.activity.miniRow1": "نقلت سارة م. يوسف ك. من حافلة 03 إلى حافلة 07",
  "guide.activity.miniFrom": "حافلة 03",
  "guide.activity.miniTo": "حافلة 07",
  "activity.unknownEvent": "حدث لا يتعرّف عليه هذا الإصدار",
  "activity.none": "—",
  "activity.yes": "نعم",
  "activity.no": "لا",
  "activity.actorColumn": "من",
  "activity.outcomeColumn": "النتيجة",
  "activity.outcome.success": "تم",
  "activity.preset.today": "اليوم",
  "activity.preset.days": "آخر {count} يومًا",
  "activity.preset.days.one": "آخر يوم واحد",
  "activity.title": "النشاط",
  "activity.subtitle":
    "كل تغيير في هذه المدرسة، الأحدث أولًا. للقراءة فقط — تُحفظ السجلات 12 شهرًا.",
  "activity.finding.changes": "{count} تغييرًا في هذه الفترة · آخرها {when}",
  "activity.finding.changes.one": "تغيير واحد في هذه الفترة · آخرها {when}",
  "activity.finding.failed": "{count} محاولة دخول فاشلة في هذه الفترة",
  "activity.finding.failed.one": "محاولة دخول فاشلة واحدة في هذه الفترة",

  "activity.family.all": "الكل",
  "activity.family.access": "الوصول",
  "activity.family.student": "الطلاب",
  "activity.family.roll": "الكشف",
  "activity.family.settings": "المدرسة",
  "activity.family.aria": "احصر العرض في نوع واحد من التغييرات",

  "activity.filter.actor": "الجميع",
  "activity.filter.actorAria": "احصر العرض في شخص واحد",
  "activity.filter.system": "النظام",
  "activity.filter.range": "التواريخ",
  "activity.filter.clear": "مسح عوامل التصفية",
  "activity.filter.showing": "{shown} من {total}",

  "activity.col.what": "ما الذي حدث",
  "activity.col.when": "الوقت",
  "activity.expand": "إظهار التفاصيل",
  "activity.collapse": "إخفاء التفاصيل",

  "activity.empty.title": "لا نشاط بعد",
  "activity.empty.body": "تظهر التغييرات هنا فور حدوثها. وسّع نطاق التواريخ للرجوع أبعد.",
  "activity.noMatch.title": "لا شيء يطابق عوامل التصفية",
  "activity.noMatch.body": "وسّع نطاق التواريخ، أو اختر «الكل».",
  "activity.error.title": "تعذّر تحميل سجل النشاط",
  "activity.error.body": "لم يُفقد شيء — السجلات ما زالت محفوظة. حاول مرة أخرى.",
  "activity.retry": "إعادة المحاولة",
  "activity.export": "تصدير CSV",

  "activity.details.title": "تفاصيل تقنية",
  "activity.details.recorded": "وُصل عند",
  "activity.details.pressed": "وقت الجهاز",
  "activity.details.writtenBy": "كتبه",
  "activity.details.entry": "المُدخل",
  "activity.source.api": "الخادم",
  "activity.source.client": "المتصفح",
  "activity.source.system": "سكربت صيانة",
  "activity.changes.field": "الحقل",
  "activity.changes.before": "قبل",
  "activity.changes.after": "بعد",
  "activity.changes.none": "لم تُسجَّل قيم حقول لهذا المُدخل.",

  "activity.unknownActor": "حساب غير معروف",
  "activity.removed": "طالب محذوف",
  "activity.noBus": "بدون حافلة",
  "activity.noDriver": "بدون سائق",
  "activity.outcome.failed": "فشل",

  "activity.field.busId": "الحافلة",
  "activity.field.status": "الحالة",
  "activity.field.driver": "السائق",
  "activity.field.assignmentMode": "عمود التعيينات",
  "activity.field.screens": "الشاشات",
  "activity.field.owner": "المدير الرئيسي",
  "activity.mode.bus": "الحافلة",
  "activity.mode.driver": "السائق",

  "activity.event.signIn": "سجّل {actor} الدخول",
  "activity.event.signInFailed": "فشلت محاولة دخول باسم {actor}",
  "activity.event.codeSignIn": "سجّل {actor} الدخول برمز وصول",
  "activity.event.driverCreated": "أنشأ {actor} حساب سائق لـ {target}",
  "activity.event.codeRotated": "أنشأ {actor} رمز وصول جديدًا لـ {target}",
  "activity.event.operatorCreated": "أنشأ {actor} حساب مشغّل لـ {target}",
  "activity.event.screensChanged": "غيّر {actor} الشاشات المتاحة لـ {target}",
  "activity.event.passwordReset": "عيّن {actor} كلمة مرور جديدة لـ {target}",
  "activity.event.operatorRemoved": "أزال {actor} المشغّل {target}",
  "activity.event.ownerChanged": "جعل {actor} {target} المدير الرئيسي",
  "activity.event.busChanged": "نقل {actor} {target} من {from} إلى {to}",
  "activity.event.driverChanged": "عيّن {actor} سائق {bus} إلى {driver}",
  "activity.event.attendanceChanged": "سجّل {actor} {target} كـ {to}",
  "activity.event.runCompleted":
    "أنهى {actor} رحلة {bus}؛ سُجّل {count} طالب غير محسوب كغائب",
  "activity.event.runCompleted.one":
    "أنهى {actor} رحلة {bus}؛ سُجّل طالب واحد غير محسوب كغائب",
  "activity.event.runDispatched": "أطلق {actor} رحلة {bus} لـ {count} طالبًا",
  "activity.event.runDispatched.one": "أطلق {actor} رحلة {bus} لطالب واحد",
  "activity.event.imported": "استورد {actor} جدولًا ونقل {count} طالبًا",
  "activity.event.imported.one": "استورد {actor} جدولًا ونقل طالبًا واحدًا",
  "activity.event.assignmentModeChanged": "غيّر {actor} عمود التعيينات إلى {to}",
  "activity.event.exported": "صدّر {actor} هذا السجل",
};
