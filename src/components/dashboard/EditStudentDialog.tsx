import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/arc/button/button";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/i18n/context";
import { translateDataLabel } from "@/lib/i18n/format";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { updateStudent } from "@/lib/school-admin";

/** The fields the roster may correct. The bus belongs to Assignments. */
export interface EditableStudent {
  id: string;
  name: string;
  grade: string;
  /** Needed to find today's attendance copies; `null` when unassigned. */
  busId: string | null;
}

interface EditStudentDialogProps {
  student: EditableStudent | null;
  /**
   * The classes the school already has, as stored on its students. A class is
   * picked, never typed: two spellings of one class are two classes on two
   * Reports cards, and nobody notices until the totals disagree. A class the
   * school does not have yet arrives with the sheet import.
   */
  classOptions: readonly string[];
  onClose: () => void;
}

/** Same field shape as the operator editor: 44px on a phone, 40 from sm. */
const FIELD_CLASS =
  "mt-1 h-11 w-full rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[16px] text-dash-on-surface placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary sm:h-10 sm:text-dash-body-sm";

/**
 * Correct a child's name or grade.
 *
 * The bus is deliberately absent: moving a child between buses is an
 * assignment decision with its own screen, its own permissions and its own
 * audit entry. Two ways to do one thing is how they drift apart.
 */
export function EditStudentDialog({
  student,
  classOptions,
  onClose,
}: EditStudentDialogProps) {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * The student the form is showing. Kept after `student` goes null, which is
   * what the close animation runs against — resetting on the same tick emptied
   * the fields visibly while the panel was still sliding out.
   */
  const [shown, setShown] = useState<EditableStudent | null>(student);

  // Reset per open, so a cancelled edit never leaks into the next student.
  useEffect(() => {
    if (!student) return;
    setShown(student);
    setName(student.name);
    setGrade(student.grade);
  }, [student]);

  // The child's own class is always an option, even before the school's list
  // has caught up with the roster it is drawn from.
  const classes = useMemo(() => {
    const all = new Set(classOptions.filter(Boolean));
    if (grade.trim()) all.add(grade.trim());
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [classOptions, grade]);

  const open = student !== null;
  const dirty = shown !== null && (name.trim() !== shown.name || grade.trim() !== shown.grade);

  async function save() {
    if (!shown || !user || saving || !name.trim()) return;
    setSaving(true);
    try {
      await updateStudent(
        user.uid,
        { id: shown.id, name, grade },
        { name: shown.name, grade: shown.grade, busId: shown.busId },
      );
      showToast(t("students.edit.saved"));
      onClose();
    } catch {
      showToast(t("toast.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("students.edit.title")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="flex flex-col gap-4 p-4 sm:p-5"
      >
        <h2 className="text-[18px] font-semibold leading-6 text-dash-on-surface">
          {t("students.edit.title")}
        </h2>

        <div>
          <label htmlFor="student-name" className="block text-dash-label-md text-dash-on-surface">
            {t("students.edit.name")}
          </label>
          <input
            id="student-name"
            type="text"
            autoComplete="off"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          {classes.length > 0 ? (
            <>
              <span className="block text-dash-label-md text-dash-on-surface">
                {t("students.edit.grade")}
              </span>
              <div className="mt-1">
                <DropdownMenu
                  ariaLabel={t("students.edit.grade")}
                  label={
                    grade.trim()
                      ? translateDataLabel(grade, locale, t)
                      : t("students.edit.classEmpty")
                  }
                  align="start"
                  matchTriggerWidth
                  triggerClassName="arc-field w-full"
                  searchable={
                    classes.length >= 4
                      ? {
                          placeholder: t("dropdown.searchPlaceholder"),
                          emptyLabel: t("dropdown.searchEmpty"),
                        }
                      : undefined
                  }
                  items={classes.map((option) => ({
                    label: translateDataLabel(option, locale, t),
                    checked: option === grade,
                    onSelect: () => setGrade(option),
                  }))}
                />
              </div>
            </>
          ) : (
            <>
              {/* No class exists yet: there is nothing to pick from, so the field
                  stays open until the school's first import defines one. */}
              <label
                htmlFor="student-grade"
                className="block text-dash-label-md text-dash-on-surface"
              >
                {t("students.edit.grade")}
              </label>
              <input
                id="student-grade"
                type="text"
                autoComplete="off"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className={FIELD_CLASS}
              />
            </>
          )}
        </div>

        <p className="text-[12.5px] leading-5 text-dash-on-surface-variant">
          {t("students.edit.sheetNote")}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="md" className="arc-field" onClick={onClose}>
            {t("students.edit.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={saving}
            disabled={saving || !dirty || !name.trim()}
          >
            {t("students.edit.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
