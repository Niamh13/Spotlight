/* Ways of narrowing the nomination list that more than one screen needs.
   Pure functions over the data, kept out of store.jsx so the store stays about
   state rather than about questions you can ask of it. */

/* A nomination "involves" you if you wrote it or it is about you. Both Home and
   My Recognition show the same set, so the rule lives in one place - otherwise
   the two screens could quietly drift apart on what counts as yours. */
export function involvesMe(nomination, email) {
  const me = String(email || "").toLowerCase();
  return String(nomination.nominatorEmail || "").toLowerCase() === me ||
         String(nomination.nomineeEmail || "").toLowerCase() === me;
}
