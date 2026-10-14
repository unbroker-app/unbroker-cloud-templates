# Kev

Run a small decision model behind a TypeSafe-compatible API. Send text and ask
yes/no questions, choose between categories, or score it against ordered criteria.

## What gets deployed

One public API running **Kev-0.8B on CPU**, with code and model weights pinned
to fixed revisions. A 10 GiB volume stores the downloaded model and cache.
The container is maintained at [unbroker-app/kev-container](https://github.com/unbroker-app/kev-container);
inference code comes from [Kev](https://github.com/jaredpalmer/kev).

The template configures **6 GiB RAM and 2 vCPUs per replica** automatically.
These configured limits are billed while the replica runs.
First boot downloads several gigabytes from Hugging Face and
can take several minutes. Keep the volume so restarts can reuse the weights.

## After deploy

Open the service URL to see the API connection information. This template serves
the API, not the upstream playground. There is no account registration.

Copy the generated `KEV_API_KEY` from the service environment settings. Set
`KEV_URL` to the public HTTPS service URL and `KEV_API_KEY` to that key in your
client environment, then send a request:

```sh
curl "$KEV_URL/v1/systemone" \
  -H "Authorization: Bearer $KEV_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"state":"The sky is blue.","questions":{"blue":{"type":"noul","instructions":"Is the sky blue?"}}}'
```

`GET /v1/models` uses the same bearer token. `/healthz` is public and answers
only after the model is loaded. Never include the API key in browser-side code.

## Limits

This CPU configuration is intended for evaluation and light workloads. Measure
latency with your actual documents before production use. It does not deploy a
GPU, fine-tuning, or the larger Kev models. The model cache is disabled to keep
per-request memory usage more predictable; downloaded weights remain persistent.
Long inputs and concurrent requests can require more memory than the baseline.

Deleting the volume removes cached weights; a subsequent deployment must download
them again. Kev and its base model are Apache-2.0 licensed.
