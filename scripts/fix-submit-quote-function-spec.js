// Fix submit_quote tool — function: {} is empty, which makes Jennifer fail to
// load and bricks the BR Unified Squad with call.start.error-get-assistant.
//
// Root cause discovered 2026-05-08: VAPI apiRequest tools need BOTH the
// top-level `name/url/method/body` (so VAPI can build the HTTP request) AND
// `function.name/description/parameters` (so the LLM gets the OpenAI function
// spec). At some point submit_quote lost its `function.*` block, leaving an
// empty {}. The empty function spec rejects when the LLM provider validates
// it, the assistant fails to instantiate, and the squad fails on every call.
//
// This script patches `function.name`, `function.description`, and
// `function.parameters` from the existing `name`, `description`, and `body`
// fields at top-level. Idempotent — re-running detects an already-populated
// function and exits cleanly.

const VAPI_KEY = process.env.VAPI_KEY;
if (!VAPI_KEY) { console.error('VAPI_KEY env var is not set.'); process.exit(1); }

const TOOL_ID = 'da21631c-4ba2-4b41-9c06-cb7ffc1c8428'; // submit_quote

async function vapi(method, path, body) {
  const res = await fetch(`https://api.vapi.ai${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${VAPI_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
  if (!res.ok) throw new Error(`VAPI ${method} ${path} (${res.status}): ${JSON.stringify(data).slice(0, 600)}`);
  return data;
}

async function main() {
  const tool = await vapi('GET', `/tool/${TOOL_ID}`);
  const func = tool.function || {};
  if (func.name && func.parameters) {
    console.log(`✓ function.* already populated. Nothing to do.`);
    return;
  }

  const topName = tool.name;
  const topDesc = tool.description;
  const topBody = tool.body;
  if (!topName || !topDesc || !topBody) {
    throw new Error(`Tool is missing top-level name/description/body. Cannot reconstruct function spec.`);
  }

  console.log(`Reconstructing function spec from top-level fields:`);
  console.log(`  name: ${topName}`);
  console.log(`  description: ${topDesc.slice(0, 80)}...`);
  console.log(`  body keys: ${Object.keys(topBody).join(', ')}`);

  const patch = {
    function: {
      name: topName,
      description: topDesc,
      parameters: topBody,
    }
  };

  await vapi('PATCH', `/tool/${TOOL_ID}`, patch);

  const after = await vapi('GET', `/tool/${TOOL_ID}`);
  const afterFunc = after.function || {};
  if (!afterFunc.name || !afterFunc.parameters) {
    throw new Error(`Function spec did not stick after PATCH. function.* still empty.`);
  }
  console.log(`\n✓ Fixed.`);
  console.log(`  function.name: ${afterFunc.name}`);
  console.log(`  function.description: ${afterFunc.description?.slice(0, 80)}...`);
  console.log(`  function.parameters keys: ${Object.keys(afterFunc.parameters).join(', ')}`);
}

main().catch(err => { console.error(`✗ FAILED: ${err.message}`); process.exit(1); });
