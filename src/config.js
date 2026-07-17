// Supabase project for the MARK3085 Week 7 tutorial.
//
// These two values are safe to ship in public source. The publishable key
// only permits what the table's row-level security policies allow (insert,
// read and update rows in the `submissions` table, nothing else). It is not
// a secret and is meant to sit in client-side code.
//
// The tutor passphrase below only gates the tutor VIEW in this app. It is
// NOT security: anyone reading this file can see it. It just stops a student
// wandering into the submissions board by accident. Do not reuse a real
// password here.

export const SUPABASE_URL = "https://pqpedkadjmdlokgmvjpe.supabase.co";
export const SUPABASE_KEY = "sb_publishable_VNTaN4KW8KPZOgw7ZXruUw_jTXw1S__";

export const TUTOR_PASSPHRASE = "13111984";
