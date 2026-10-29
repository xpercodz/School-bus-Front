import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { Icon } from "@/components/Icon";
import { SlideSegments } from "@/components/SlideSegments";
import { useToast } from "@/components/Toast";
import { RUN_SEGMENTS, type RunSegmentId } from "@/data/dashboard";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { buildRunId, todayDateStr } from "@/lib/school-data";
import { fetchSchoolId } from "@/lib/school-id";
import { useLocale } from "@/lib/i18n/context";
import { translateDataLabel } from "@/lib/i18n/format";

interface DispatchModalProps {
  open: boolean;
  onClose: () => void;
}

interface DispatchBus {
  id: string;
  name: string;
  driver: string;
}

/**
 * Dispatch a vehicle: pick a bus, run type, and date, then create the run and
 * pre-register that bus's students as WAITING. Self-contained — fetches its own
 * buses and performs the write; in mock mode it only toasts (no Firestore).
 * The form lives in its own component so it remounts (fresh state) each open.
 */
export function DispatchModal({ open, onClose }: DispatchModalProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onClose={onClose} title={t("dispatch.title")} exitAnimation={false}>
      {open && <DispatchForm onClose={onClose} />}
    </Dialog>
  );
}

function DispatchForm({ onClose }: { onClose: () => void }) {
  const { t, locale } = useLocale();
  const { showToast } = useToast();
  const { user } = useAuth();
  const uid = user?.uid;

  const [buses, setBuses] = useState<DispatchBus[]>([]);
  const [busId, setBusId] = useState("");
  const selectedBus = buses.find((bus) => bus.id === busId);
  const [runType, setRunType] = useState<RunSegmentId>("morning");
  const [date, setDate] = useState(todayDateStr());
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!db || !uid) return;
    const firestore = db;
    let cancelled = false;
    void fetchSchoolId(uid).then(async (schoolId) => {
      if (cancelled || !schoolId) return;
      try {
        const snap = await getDocs(collection(firestore, "schools", schoolId, "buses"));
        if (cancelled) return;
        setBuses(
          snap.docs.map((d) => ({
            id: d.id,
            name: (d.data().name as string) ?? d.id,
            driver: (d.data().driver as string) ?? "",
          })),
        );
      } catch {
        if (!cancelled) setLoadError(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function handleDispatch() {
    if (!busId || !date || busy) return;
    setBusy(true);
    try {
      if (!db || !uid) return;
      const schoolId = await fetchSchoolId(uid);
      if (!schoolId) return;
      const firestore = db;
      const runId = buildRunId(busId, date, runType);
      const runRef = doc(firestore, "schools", schoolId, "runs", runId);
      const existing = await getDoc(runRef);
      if (existing.exists()) {
        showToast(t("toast.dispatchExists"));
        return;
      }
      const bus = buses.find((b) => b.id === busId);
      const studentsSnap = await getDocs(
        query(
          collection(firestore, "schools", schoolId, "students"),
          where("busId", "==", busId),
        ),
      );
      const batch = writeBatch(firestore);
      batch.set(runRef, { busId, runType, date, status: "IN_PROGRESS" });
      for (const studentDoc of studentsSnap.docs) {
        const data = studentDoc.data();
        batch.set(
          doc(firestore, "schools", schoolId, "attendance", `${runId}__${studentDoc.id}`),
          {
            runId,
            date,
            busId,
            busName: bus?.name ?? "",
            studentName: (data.name as string) ?? "",
            grade: (data.grade as string) ?? "",
            status: "WAITING",
            boardedAt: null,
            droppedOffAt: null,
          },
        );
      }
      await batch.commit();
      onClose();
      showToast(t("toast.dispatched"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Sticky sheet header — the close target stays reachable while the form
          scrolls under it on a phone-sized bottom sheet. 16px gutters; 44px
          close on every breakpoint. */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2.5 sm:px-5">
        <h2 className="min-w-0 truncate text-[18px] font-semibold text-on-surface sm:text-headline-md">
          {t("dispatch.title")}
        </h2>
        <Button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          variant="ghost"
          size="md"
          icon
          className="flex-none"
        >
          <Icon name="close" size={22} />
        </Button>
      </header>

      <form
        className="flex flex-1 flex-col"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void handleDispatch();
        }}
      >
        <div className="flex flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-label-lg text-on-surface-variant">{t("dispatch.bus")}</span>
            <DropdownMenu
              ariaLabel={t("dispatch.bus")}
              label={selectedBus ? translateDataLabel(selectedBus.name, locale, t) : t("dispatch.selectBus")}
              align="start"
              matchTriggerWidth
              disabled={busy}
              triggerClassName="arc-field h-11 w-full"
              items={[
                {
                  label: t("dispatch.selectBus"),
                  checked: !busId,
                  onSelect: () => setBusId(""),
                },
                ...buses.map((bus) => ({
                  label: translateDataLabel(bus.name, locale, t),
                  checked: bus.id === busId,
                  onSelect: () => setBusId(bus.id),
                })),
              ]}
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-label-lg text-on-surface-variant">
              {t("dispatch.runType")}
            </legend>
            <SlideSegments
              variant="box"
              ariaLabel={t("dispatch.runType")}
              options={RUN_SEGMENTS.map((item) => ({
                id: item.id,
                label: t(
                  item.id === "morning"
                    ? "runType.morningPickup"
                    : "runType.afternoonDropoff",
                ),
              }))}
              value={runType}
              onChange={setRunType}
            />
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-label-lg text-on-surface-variant">{t("dispatch.date")}</span>
            {/* 16px on phones is what stops iOS from zooming the sheet when the
                date field takes focus. */}
            <input
              type="date"
              required
              value={date}
              disabled={busy}
              onChange={(event) => setDate(event.target.value)}
              className="h-12 w-full min-w-0 rounded-lg border border-control-outline bg-surface px-3 text-[16px] text-on-surface outline-none transition-[border-color,box-shadow] duration-[var(--t-hover)] focus:border-primary focus:ring-2 focus:ring-primary/35 sm:h-11 sm:text-[12.5px]"
            />
          </label>

          {loadError && (
            <p role="alert" className="text-body-md text-error">
              {t("dispatch.loadError")}
            </p>
          )}
        </div>

        {/* Sits at the bottom of the sheet and stays there while the fields
            scroll: full-width stacked on a phone, side-by-side at sm+. The
            Dialog's safe-area padding lives on the panel, not here, so the
            primary never hides under the home indicator. */}
        <div className="sticky bottom-0 z-10 mt-auto flex flex-col gap-2 border-t border-outline-variant bg-surface px-4 pb-3 pt-3 sm:flex-row sm:justify-end sm:px-5">
          <Button
            type="button"
            onClick={onClose}
            disabled={busy}
            variant="secondary"
            size="md"
            className="arc-field w-full sm:w-auto"
          >
            {t("dialog.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={!busId || !date || busy}
            loading={busy}
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
          >
            {t("dispatch.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
