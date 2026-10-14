// Validate a real authenticated inference before and after the harness restart.
export async function setup({ exec }) {
  exec("kev", ["sh", "-c", "test -d /data/huggingface/hub && touch /data/e2e-restart-marker"]);
}

export async function verify({ http, env, exec, assert }) {
  for (const headers of [{}, { Authorization: "Bearer wrong-key" }]) {
    const denied = await http("kev", "/v1/models", { headers });
    assert(denied.status === 401, `unauthorized model listing rejected (${denied.status})`);
    const inference = await http("kev", "/v1/systemone", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ state: "test" }),
    });
    assert(inference.status === 401, `unauthorized inference rejected (${inference.status})`);
  }
  const headers = { Authorization: `Bearer ${env("kev").KEV_API_KEY}` };
  const models = await http("kev", "/v1/models", { headers });
  assert(models.status === 200 && models.json?.models?.length > 0, "authenticated model listing works");
  const result = await http("kev", "/v1/systemone", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      state: "The sky is blue.",
      questions: { blue: { type: "noul", instructions: "Is the sky blue?" } },
    }),
  });
  const answer = result.json?.answers?.blue;
  assert(result.status === 200 && answer?.type === "noul" &&
    typeof answer.noul === "number" && answer.noul >= 0 && answer.noul <= 1,
    `inference returns a probability (${result.status}: ${result.text})`);
  exec("kev", ["test", "-f", "/data/e2e-restart-marker"]);
}
