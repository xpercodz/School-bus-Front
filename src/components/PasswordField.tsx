import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/types";
import {
  PASSWORD_RULES,
  unmetPasswordRules,
  type PasswordRuleId,
} from "@/lib/password";

/** One label per rule, in the order `PASSWORD_RULES` declares them. */
const RULE_LABEL_KEY: Record<PasswordRuleId, MessageKey> = {
  length: "operators.pw.length",
  upper: "operators.pw.upper",
  lower: "operators.pw.lower",
  digit: "operators.pw.digit",
  symbol: "operators.pw.symbol",
};

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** A line under the field — what the password is for, or what happens if it's blank. */
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  /**
   * Draw the checklist. `false` keeps it out of the way for the optional reset
   * field until the director actually starts typing.
   */
  showRules?: boolean;
  /** When given, a Generate button sits under the field and reveals its answer. */
  onGenerate?: () => void;
  /** The id of the form's error paragraph, wired to `aria-describedby`. */
  errorId?: string;
}

/**
 * A password input for an account someone ELSE will sign in with: always
 * revealable, generatable, and honest about what it wants.
 *
 * Three things it does that a bare `<input type="password">` cannot:
 *
 * 1. **Reveal.** The director reads the password off the screen and hands it
 *    over; typing it twice to check it is how a wrong password gets shipped.
 *    Generating reveals it too, since a generated value is meant to be copied.
 * 2. **Generate.** Sixteen random characters, ambiguous glyphs (`l/1/I`, `O/0`)
 *    left out — the value crosses from a screen to a person to a keyboard.
 * 3. **Check live.** Each rule in `lib/password.ts` turns green as it is met, so
 *    the requirement is visibly satisfied BEFORE submit rather than explained by
 *    an error afterwards. The same rules are enforced server-side.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
  autoComplete = "new-password",
  required = false,
  disabled = false,
  showRules = true,
  onGenerate,
  errorId,
}: PasswordFieldProps) {
  const { t } = useLocale();
  const [revealed, setRevealed] = useState(false);

  const unmet = new Set(unmetPasswordRules(value).map((rule) => rule.id));
  const metCount = PASSWORD_RULES.length - unmet.size;
  const hintId = hint ? `${id}-hint` : undefined;
  const rulesId = `${id}-rules`;
  const describedBy =
    [errorId, hintId, showRules ? rulesId : undefined].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-dash-label-md text-dash-on-surface">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          className="mt-1 h-11 w-full rounded-lg border border-dash-control-outline bg-dash-surface px-3 pe-12 text-[16px] text-dash-on-surface placeholder:text-dash-outline focus:border-dash-primary focus:outline-none focus:ring-1 focus:ring-dash-primary sm:h-10 sm:text-dash-body-sm"
        />
        {/* The wrapper owns the overlay position: the Button module sets
            position: relative. */}
        <div className="absolute end-1 top-1/2 -translate-y-1/2">
          <Button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={t(revealed ? "operators.hidePassword" : "operators.showPassword")}
            aria-pressed={revealed}
            variant="ghost"
            size="sm"
            icon
          >
            <Icon
              name={revealed ? "visibility_off" : "visibility"}
              size={19}
              variant="outlined"
            />
          </Button>
        </div>
      </div>

      {hint && (
        <p id={hintId} className="mt-1.5 text-[11.5px] leading-4 text-dash-on-surface-variant">
          {hint}
        </p>
      )}

      {onGenerate && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="arc-field mt-2 w-full sm:w-auto"
          disabled={disabled}
          onClick={() => {
            onGenerate();
            // A generated value exists to be read and handed over.
            setRevealed(true);
          }}
        >
          <Icon name="refresh" size={16} variant="outlined" />
          {t("operators.generate")}
        </Button>
      )}

      {showRules && (
        <div id={rulesId} className="mt-2.5">
          <ul className="flex flex-col gap-1">
            {PASSWORD_RULES.map((rule) => {
              const met = !unmet.has(rule.id);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 text-[11.5px] leading-4 transition-colors duration-[var(--t-ui)] ${
                    met ? "text-dash-success" : "text-dash-on-surface-variant"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 flex-none items-center justify-center"
                  >
                    {met ? (
                      <Icon name="check" size={14} variant="rounded" />
                    ) : (
                      <span className="h-2 w-2 rounded-full border border-current" />
                    )}
                  </span>
                  {t(RULE_LABEL_KEY[rule.id])}
                </li>
              );
            })}
          </ul>
          {/* Colour alone must not be the state: this is the same count in words. */}
          <p className="sr-only" aria-live="polite">
            {t("operators.pw.progress", {
              met: metCount,
              total: PASSWORD_RULES.length,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
