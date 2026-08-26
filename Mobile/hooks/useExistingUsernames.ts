import { useCallback, useMemo } from "react";

import { useSearch } from "./useSearch";

/**
 * Existing-usernames helper used by the profile-edit flow for
 * client-side collision checks while the user types a new handle.
 *
 * Why this is purely derived (no local state):
 *  The previous version mirrored `allUsernames` from `useSearch` into
 *  local `useState` via a `useEffect`. Any time the upstream array
 *  reference changed -- which happened on every render of `usePosts`'s
 *  consumers because the flatMapped feed wasn't memoised -- the effect
 *  fired, called setState, triggered another render, produced a new
 *  reference, and the loop never stabilised. React caught it and threw
 *  "Maximum update depth exceeded" on the Profile screen.
 *
 *  The fix is structural: state that is fully derivable from another
 *  hook's output should not be mirrored. We compute everything from the
 *  upstream value directly, memoised on the same identity, and the
 *  cycle disappears.
 */
export const useExistingUsernames = () => {
  const { allUsernames } = useSearch();

  // Set lookup is O(1) for `isUsernameTaken`, which the validator can
  // call once per keystroke without rebuilding on every call.
  const usernameSet = useMemo(() => new Set(allUsernames), [allUsernames]);

  const isUsernameTaken = useCallback(
    (username: string): boolean => usernameSet.has(username.toLowerCase()),
    [usernameSet]
  );

  const getAllUsernames = useCallback((): string[] => [...allUsernames], [allUsernames]);

  return {
    existingUsernames: allUsernames,
    isUsernameTaken,
    getAllUsernames,
    isLoading: false,
  };
};
