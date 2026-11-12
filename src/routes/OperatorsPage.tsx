import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useToast } from "@/components/Toast";
import {
  ApiError,
  createOperator,
  removeOperator,
  updateOperatorPassword,
  updateOperatorScreens,
} from "@/lib/api";
import { useSchoolTeam, type TeamMember } from "@/lib/school-admin";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/arc/button/button";
import { Dialog } from "@/components/Dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { PasswordField } from "@/components/PasswordField";
import { generatePassword, isPasswordStrong } from "@/lib/password";
import { useLocale } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_OPERATOR_SCREENS,
  GRANTABLE_SCREENS,
  SCREEN_LABEL_KEY,
} from "@/lib/permissions";
import type { OperatorScreen } from "@/lib/api-contract";

/** The app's field shape, shared by the three text inputs. */
const FIELD_CLASS =
  "mt-1 h-11 w-full rounded-lg border border-dash-control-outline bg-dash-surface px-3 text-[16px] text-dash-on-surface placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary sm:h-10 sm:text-dash-body-sm";

/** What the editor dialog is doing: a new account, or one account's screens. */
interface EditorState {
  mode: "create" | "edit";
  member: TeamMember | null;
  name: string;
  email: string;
  password: string;
  screens: OperatorScreen[];
}

const EMPTY_EDITOR: EditorState = {
  mode: "create",
  member: null,
  name: "",
  email: "",
  password: "",
  screens: [...DEFAULT_OPERATOR_SCREENS],
};

/**
 * Main-director-only Operators page (the route guard enforces `owner`): who is
 * on the team, and which screens each operator may open.
 *
 * It is deliberately small — a list, a tick list, and removal. The account is
 * created by the API (Firebase Auth users can't be made from the browser), and
 * the ticks are the ONLY thing an owner can change afterwards, so there is no
 * "edit permissions" form that can rename a colleague or move their school.
 *
 * Hiding this page is not what protects it: `firestore.rules` gates the data on
 * the same screen names, and the API's operator routes refuse anyone without
 * `owner: true` on their profile.
 */
export default function OperatorsPage() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { user } = useAuth();
  const uid = user?.uid;
  const { team, loading } = useSchoolTeam();

  const directors = useMemo(
    () => team.filter((member) => member.role === "director"),
    [team],
  );
  const operators = useMemo(
    () => team.filter((member) => member.role === "operator"),
    [team],
  );

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  /**
   * The account just created, kept only long enough to show its password once.
   * The password is not stored anywhere (Firebase hashes it), so this is the
   * director's single chance to copy what they chose — the same "shown once"
   * pattern the Drivers page uses for access codes.
   */
  const [created, setCreated] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  function openCreate() {
    setFormError(null);
    setEditor({ ...EMPTY_EDITOR });
  }

  function openEdit(member: TeamMember) {
    setFormError(null);
    setEditor({
      mode: "edit",
      member,
      name: member.displayName,
      email: member.email,
      password: "",
      screens: member.screens.length > 0 ? [...member.screens] : [...DEFAULT_OPERATOR_SCREENS],
    });
  }

  function closeEditor() {
    if (busy) return;
    setEditor(null);
    setFormError(null);
  }

  /** A sixteen-character password that already meets every check. */
  function handleGenerate() {
    setFormError(null);
    setEditor((current) => (current ? { ...current, password: generatePassword() } : current));
  }

  async function handleCopyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.password);
      showToast(t("operators.copied"));
    } catch {
      showToast(t("operators.copyError"));
    }
  }

  function toggleScreen(screen: OperatorScreen) {
    setEditor((current) => {
      if (!current) return current;
      const has = current.screens.includes(screen);
      return {
        ...current,
        screens: has
          ? current.screens.filter((s) => s !== screen)
          : [...current.screens, screen],
      };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;

    // The checklist is the explanation; this is the guard, so a value the
    // server would refuse never costs a round trip. Editing without typing a
    // password is a normal screens-only save.
    const passwordRequired = editor.mode === "create" || editor.password !== "";
    if (passwordRequired && !isPasswordStrong(editor.password)) {
      setFormError(t("operators.passwordWeak"));
      return;
    }
    if (editor.screens.length === 0) {
      setFormError(t("operators.screensRequired"));
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (editor.mode === "create") {
        const displayName = editor.name.trim();
        await createOperator({
          email: editor.email.trim(),
          password: editor.password,
          displayName,
          screens: editor.screens,
        });
        // Hold the credentials for the confirmation panel BEFORE closing the
        // form, or the password is gone the moment the dialog unmounts.
        setCreated({
          name: displayName,
          email: editor.email.trim(),
          password: editor.password,
        });
      } else if (editor.member) {
        await updateOperatorScreens(editor.member.uid, editor.screens);
        if (editor.password) {
          // Screens first: if the password call fails the grants still landed,
          // and the two toasts would otherwise claim the wrong thing.
          await updateOperatorPassword(editor.member.uid, editor.password);
          showToast(t("operators.passwordChanged"));
        } else {
          showToast(t("operators.saved"));
        }
      }
      setEditor(null);
    } catch (error) {
      if (error instanceof ApiError && error.code === "email_in_use") {
        setFormError(t("operators.emailTaken"));
      } else if (error instanceof ApiError && error.code === "invalid_request") {
        // The server refused the value itself — the checklist is the fix.
        setFormError(t("operators.passwordWeak"));
      } else {
        setFormError(
          t(editor.mode === "create" ? "operators.createError" : "operators.updateError"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeOperator(removing.uid);
      showToast(t("operators.removed"));
      setRemoving(null);
    } catch {
      showToast(t("operators.removeError"));
    } finally {
      setRemoveBusy(false);
    }
  }

  const sectionTitle = (icon: ReactNode, label: string, hint: string) => (
    <div className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-dash-on-surface">
        {icon}
        {label}
      </h2>
      <p className="text-[12.5px] leading-4 text-dash-on-surface-variant">{hint}</p>
    </div>
  );

  /** "You" and "Main director" — the only two badges a team row ever carries. */
  const badges = (member: TeamMember) => (
    <>
      {member.uid === uid && (
        <span className="rounded bg-dash-surface-container px-1.5 py-0.5 text-[10.5px] font-medium text-dash-on-surface-variant">
          {t("operators.selfTag")}
        </span>
      )}
      {member.owner && (
        <span className="rounded bg-dash-primary-container px-1.5 py-0.5 text-[10.5px] font-medium text-dash-on-primary-container">
          {t("operators.ownerTag")}
        </span>
      )}
    </>
  );

  return (
    <>
      <div className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader
            title={t("operators.title")}
            subtitle={t("operators.subtitle")}
            actions={
              <Button type="button" variant="primary" size="md" onClick={openCreate}>
                <Icon name="person_add" size={16} variant="outlined" />
                {t("operators.create")}
              </Button>
            }
          />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-4 sm:p-6">
        {loading ? (
          <div
            role="status"
            aria-label={t("dashboard.loading")}
            className="h-44 animate-pulse rounded-lg border border-dash-outline-variant bg-dash-surface"
          />
        ) : (
          <>
            {/* Directors — read-only. This page cannot create one, and cannot
                change a director's access; it only says who already has it. */}
            <section className="flex flex-col gap-3">
              {sectionTitle(
                <Icon name="badge" size={18} variant="outlined" className="flex-none" />,
                t("operators.directors"),
                t("operators.directorsHint"),
              )}
              <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                <ul className="divide-y divide-dash-outline-variant">
                  {directors.map((member) => (
                    <li
                      key={member.uid}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium leading-5 text-dash-on-surface">
                          <span className="truncate">{member.displayName || "—"}</span>
                          {badges(member)}
                        </p>
                        <p className="truncate text-[12px] leading-4 text-dash-on-surface-variant">
                          {member.email}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Operators — the part this page exists for. */}
            <section data-tour="operators-list" className="flex flex-col gap-3">
              {sectionTitle(
                <Icon name="manage_accounts" size={18} variant="outlined" className="flex-none" />,
                t("operators.operators"),
                t("operators.operatorsHint"),
              )}

              {operators.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dash-outline-variant bg-dash-surface px-4 py-10 text-center">
                  <Icon
                    name="manage_accounts"
                    size={32}
                    variant="outlined"
                    className="text-dash-on-surface-variant"
                  />
                  <p className="text-[13px] font-medium text-dash-on-surface">
                    {t("operators.empty")}
                  </p>
                  <p className="max-w-md text-[12.5px] leading-5 text-dash-on-surface-variant">
                    {t("operators.emptyHint")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="arc-field mt-1"
                    onClick={openCreate}
                  >
                    <Icon name="person_add" size={16} variant="outlined" />
                    {t("operators.create")}
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-dash-outline-variant bg-dash-surface">
                  <ul className="divide-y divide-dash-outline-variant">
                    {operators.map((member) => (
                      <li
                        key={member.uid}
                        className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium leading-5 text-dash-on-surface">
                            <span className="truncate">{member.displayName || "—"}</span>
                            {badges(member)}
                          </p>
                          <p className="truncate text-[12px] leading-4 text-dash-on-surface-variant">
                            {member.email}
                          </p>
                          {/* The answer to "what can they see", in words. A chip
                              per screen rather than a count: the owner should be
                              able to check it without opening the editor. */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {GRANTABLE_SCREENS.filter((screen) =>
                              member.screens.includes(screen),
                            ).map((screen) => (
                              <span
                                key={screen}
                                className="rounded bg-dash-surface-container px-1.5 py-0.5 text-[11px] leading-4 text-dash-on-surface-variant"
                              >
                                {t(SCREEN_LABEL_KEY[screen])}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-none sm:flex-row">
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            className="arc-field w-full sm:w-auto"
                            onClick={() => openEdit(member)}
                          >
                            {t("operators.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="md"
                            className="arc-field w-full sm:w-auto"
                            onClick={() => setRemoving(member)}
                          >
                            {t("operators.remove")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Dialog
        open={editor !== null}
        onClose={closeEditor}
        title={
          editor?.mode === "edit"
            ? t("operators.editTitle", { name: editor.member?.displayName ?? "" })
            : t("operators.newTitle")
        }
        dismissable={!busy}
        exitAnimation={false}
      >
        {editor && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 sm:p-6">
            <h2 className="text-[18px] font-semibold leading-6 text-dash-on-surface">
              {editor.mode === "edit"
                ? t("operators.editTitle", { name: editor.member?.displayName ?? "" })
                : t("operators.newTitle")}
            </h2>

            {editor.mode === "create" ? (
              <>
                <div>
                  <label htmlFor="operator-name" className="block text-dash-label-md text-dash-on-surface">
                    {t("operators.nameLabel")}
                  </label>
                  <input
                    id="operator-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={editor.name}
                    onChange={(e) =>
                      setEditor((current) => (current ? { ...current, name: e.target.value } : current))
                    }
                    placeholder={t("operators.namePlaceholder")}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="operator-email" className="block text-dash-label-md text-dash-on-surface">
                    {t("operators.emailLabel")}
                  </label>
                  <input
                    id="operator-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={editor.email}
                    onChange={(e) =>
                      setEditor((current) => (current ? { ...current, email: e.target.value } : current))
                    }
                    placeholder={t("operators.emailPlaceholder")}
                    className={FIELD_CLASS}
                  />
                </div>
                <PasswordField
                  id="operator-password"
                  label={t("operators.passwordLabel")}
                  value={editor.password}
                  onChange={(password) =>
                    setEditor((current) => (current ? { ...current, password } : current))
                  }
                  hint={t("operators.passwordHint")}
                  required
                  onGenerate={handleGenerate}
                />
              </>
            ) : (
              <div className="rounded-lg bg-dash-surface-container-low px-3 py-2.5">
                <p className="truncate text-[13.5px] font-medium text-dash-on-surface">
                  {editor.member?.displayName}
                </p>
                <p className="truncate text-[12px] text-dash-on-surface-variant">
                  {editor.member?.email}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <p className="text-[12.5px] font-medium text-dash-on-surface">
                {t("operators.screensLabel")}
              </p>
              <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
                {t("operators.screensHint")}
              </p>
              <div
                role="group"
                aria-label={t("operators.screensLabel")}
                className="mt-1 divide-y divide-dash-outline-variant rounded-lg border border-dash-outline-variant"
              >
                {GRANTABLE_SCREENS.map((screen) => (
                  <label
                    key={screen}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2 text-[13.5px] text-dash-on-surface hover:bg-dash-surface-container-low"
                  >
                    <input
                      type="checkbox"
                      checked={editor.screens.includes(screen)}
                      onChange={() => toggleScreen(screen)}
                      className="h-4 w-4 flex-none accent-dash-primary"
                    />
                    {t(SCREEN_LABEL_KEY[screen])}
                  </label>
                ))}
              </div>
            </div>

            {editor.mode === "edit" && (
              <PasswordField
                id="operator-new-password"
                label={t("operators.newPasswordLabel")}
                value={editor.password}
                onChange={(password) =>
                  setEditor((current) => (current ? { ...current, password } : current))
                }
                hint={t("operators.newPasswordHint")}
                onGenerate={handleGenerate}
                showRules={editor.password.length > 0}
              />
            )}

            {formError && (
              <p role="alert" className="flex items-start gap-1.5 text-[12.5px] leading-4 text-dash-error">
                <Icon name="info" size={15} variant="outlined" className="mt-px flex-none" />
                {formError}
              </p>
            )}

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="arc-field w-full sm:w-auto"
                onClick={closeEditor}
                disabled={busy}
              >
                {t("dialog.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full sm:w-auto sm:min-w-20"
                loading={busy}
              >
                {editor.mode === "create"
                  ? t("operators.createAction")
                  : t("operators.save")}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* The credentials, once: the password is hashed at rest, so this panel is
          the only copy the director will ever see. Same pattern as the driver
          access code. */}
      <Dialog
        open={created !== null}
        onClose={() => setCreated(null)}
        title={t("operators.createdTitle")}
        dismissable={false}
        exitAnimation={false}
      >
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <h2 className="text-[18px] font-semibold leading-6 text-dash-on-surface">
            {t("operators.createdTitle")}
          </h2>
          <p className="text-[13px] leading-5 text-dash-on-surface-variant">
            {t("operators.createdBody", { name: created?.name ?? "" })}
          </p>
          <dl className="overflow-hidden rounded-lg border border-dash-outline-variant">
            <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <dt className="flex-none text-[11.5px] text-dash-on-surface-variant">
                {t("operators.emailLabel")}
              </dt>
              <dd className="min-w-0 truncate text-[13px] text-dash-on-surface">
                {created?.email}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dash-outline-variant px-3 py-2.5">
              <dt className="flex-none text-[11.5px] text-dash-on-surface-variant">
                {t("operators.passwordRow")}
              </dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate text-[13px] text-dash-on-surface">
                  {created?.password}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon
                  aria-label={t("operators.copyPassword")}
                  onClick={() => void handleCopyPassword()}
                >
                  <Icon name="copy" size={17} variant="outlined" />
                </Button>
              </dd>
            </div>
          </dl>
          <p className="text-[11.5px] leading-4 text-dash-on-surface-variant">
            {t("operators.credentialsHint")}
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="md" onClick={() => setCreated(null)}>
              {t("dialog.close")}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        title={t("operators.removeConfirmTitle")}
        body={t("operators.removeConfirmBody", {
          name: removing?.displayName ?? "",
        })}
        confirmLabel={t("operators.remove")}
        cancelLabel={t("dialog.cancel")}
        busy={removeBusy}
        onConfirm={() => void handleRemove()}
        onClose={() => {
          if (!removeBusy) setRemoving(null);
        }}
      />
    </>
  );
}
