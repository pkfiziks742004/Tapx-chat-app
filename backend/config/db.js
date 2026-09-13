const { createSupabaseStore } = require("./supabaseStore");

async function createStore() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env (needed for Supabase Postgres storage)."
    );
  }

  return createSupabaseStore({ url, serviceRoleKey });
}

module.exports = { createStore };
