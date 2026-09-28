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
    <Dialog open={open} onClose={onClose} title={t("dispatch.title")}>
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
    <>
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h2 className="text-headline-md text-on-surface">{t("dispatch.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="close" />
        </button>
      </div>

      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleDispatch();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-label-lg text-on-surface-variant">{t("dispatch.bus")}</span>
          <select
            value={busId}
            onChange={(event) => setBusId(event.target.value)}
            disabled={busy}
            className="h-12 rounded border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">{t("dispatch.selectBus")}</option>
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {translateDataLabel(bus.name, locale, t)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
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

        <label className="flex flex-col gap-1">
          <span className="text-label-lg text-on-surface-variant">{t("dispatch.date")}</span>
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-12 rounded border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        {loadError && (
          <p role="alert" className="text-body-md text-error">
            {t("dispatch.loadError")}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-12 items-center justify-center rounded-full px-6 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
          >
            {t("dialog.cancel")}
          </button>
          <button
            type="submit"
            disabled={!busId || !date || busy}
            className="flex h-12 min-w-28 items-center justify-center gap-2 rounded-full bg-primary px-6 text-label-lg text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Icon name="progress_activity" size={20} className="animate-spin" />
            ) : (
              t("dispatch.submit")
            )}
          </button>
        </div>
      </form>
    </>
  );
}
