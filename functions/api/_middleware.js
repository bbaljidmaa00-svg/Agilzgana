// Turn unexpected errors (e.g. a missing database binding) into a readable JSON error.
export async function onRequest({ next }) {
  try { return await next(); }
  catch (e) { return new Response(JSON.stringify({ error: "Серверийн алдаа: " + (e && e.message) }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }); }
}
