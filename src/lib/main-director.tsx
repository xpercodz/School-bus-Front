import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useSchoolTeam } from "@/lib/school-admin";
import { useUserProfile } from "@/lib/user-profile";

/**
 * Who is the school's MAIN director — the one account that may create, re-scope
 * and remove operators, and the only one whose rail shows the Operators row?
 *
 * Two answers, in this order:
 *
 * 1. the director whose profile carries `owner: true` (set by
 *    `npm run owner -- <email>` in the API repo, or by the seed script);
 * 2. **a school with exactly one director** — that director *is* the main one,
 *    because there is no other account the flag could mean.
 *
 * Rule 2 exists because requiring the script first meant the Operators row was
 * invisible on every existing deployment: the feature shipped dark, and a
 * director reasonably concluded it had not been built. Deriving the obvious
 * case is better than a bootstrap step nobody knows to run. Once a school has a
 * second director, rule 2 stops applying and the flag decides — so "main" is
 * never ambiguous.
 *
 * The API applies the same rule in `requireOwner`; this hook decides what is
 * DRAWN, not what is allowed.
 */
const MainDirectorContext = createContext(false);

function useResolvedMainDirector(): boolean {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  // An explicit flag needs no query — the common case after setup, and it costs
  // nothing to confirm.
  const isDirector = profile.role === "director";
  const needsFallback = isDirector && !profile.owner;
  const { team, loading } = useSchoolTeam(needsFallback);

  if (!isDirector) return false;
  if (profile.owner) return true;
  if (loading) return false;

  const directors = team.filter((member) => member.role === "director");
  return directors.length === 1 && directors[0]?.uid === user?.uid;
}

/** Resolves the flag once, for the whole dashboard shell. */
export function MainDirectorProvider({ children }: { children: ReactNode }) {
  const mainDirector = useResolvedMainDirector();
  return (
    <MainDirectorContext.Provider value={mainDirector}>
      {children}
    </MainDirectorContext.Provider>
  );
}

/**
 * Read the resolved answer. Outside the shell (or before it settles) this is
 * false, which keeps every caller on the safe side: no Operators row, no admin.
 */
export function useMainDirector(): boolean {
  return useContext(MainDirectorContext);
}
