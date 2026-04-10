# pip install openai pandas
import pandas as pd
import asyncio
import json
import os
import re
import logging
from openai import AsyncOpenAI

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
API_KEY = "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"
INPUT_CSV = "glad_n_young.csv"
OUTPUT_CSV = "glad_n_young_tagged_op.csv"

# Primary: NVIDIA Nemotron 3 Super (free)
# Fallback if needed: "qwen/qwen3-next-80b-a3b-instruct:free"
MODEL_NAME = "nvidia/nemotron-3-super-120b-a12b:free"

MAX_CONCURRENT_REQUESTS = 1
MAX_RETRIES = 6
OUTPUT_TOKENS_PER_ITEM = 60
MAX_PRODUCTS_PER_BATCH = 600
INPUT_TOKEN_BUDGET = 200_000
SYSTEM_PROMPT_TOKENS = 200
JSON_OVERHEAD_PER_ITEM = 30
POST_SUCCESS_DELAY = 5
RATE_LIMIT_BASE_WAIT = 30

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY,
    default_headers={
        "HTTP-Referer": "https://gladandyoungstudio.com",
        "X-Title": "Product Auto-Tagger"
    }
)

SYSTEM_PROMPT = """You are an e-commerce SEO tagger. For each product in the JSON array, generate 3-5 specific SEO tags.

Rules:
- Focus ONLY on: material, product type, specific feature, use-case
- Tags must be lowercase, hyphenated multi-word (e.g. "vegetable-tanned-leather")
- FORBIDDEN: gift, trending, best-seller, uncategorized, retail-item, general-merchandise
- Return ONLY valid JSON with no preamble or explanation: {"results": [{"handle": "...", "tags": [...]}]}

Example:
Input: [{"handle": "classic-clutch-purple-haze", "title": "Classic Clutch", "description": "Hand marbled vegetable tanned leather with brass snap closure."}]
Output: {"results": [{"handle": "classic-clutch-purple-haze", "tags": ["leather-clutch", "vegetable-tanned", "brass-snap-closure", "hand-marbled", "evening-bag"]}]}"""


# ---------------------------------------------------------
# FIX 1: Input Sanitization
# Removes HTML tags + attributes + stray backslashes before LLM
# ---------------------------------------------------------
def sanitize_description(html: str) -> str:
    text = str(html)

    # Remove all HTML tags including attributes
    text = re.sub(r'<[^>]+>', ' ', text)

    # Remove backslashes that tend to break JSON reflection
    text = text.replace('\\', ' ')

    # Remove embedded short JSON-like blobs from attributes
    text = re.sub(r"""['"]?\{[^}]{0,200}\}['"]?""", ' ', text)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ---------------------------------------------------------
# FIX 2: Output JSON Repair
# Repairs malformed JSON before json.loads()
# ---------------------------------------------------------
def safe_json_loads(raw: str) -> dict:
    # Extract first JSON object from surrounding text
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if not json_match:
        raise json.JSONDecodeError("No JSON object found in response", raw, 0)

    candidate = json_match.group(0)

    # Try plain parse first
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Repair invalid \u sequences
    fixed = re.sub(r'\\u(?![0-9a-fA-F]{4})', r'\\\\u', candidate)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Repair lone backslashes
    fixed2 = re.sub(r'\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})', r'\\\\', candidate)
    try:
        return json.loads(fixed2)
    except json.JSONDecodeError:
        pass

    # Remove trailing commas
    fixed3 = re.sub(r',(\s*[}\]])', r'\1', fixed2)
    try:
        return json.loads(fixed3)
    except json.JSONDecodeError as e:
        logging.error(f"All JSON repair attempts failed. Last error: {e}")
        logging.debug(f"Raw response snippet: {raw[:500]}")
        raise


# ---------------------------------------------------------
# Token Estimator
# ---------------------------------------------------------
def estimate_tokens(text: str) -> int:
    return max(1, len(str(text)) // 4)


# ---------------------------------------------------------
# Dynamic Batching
# ---------------------------------------------------------
def build_dynamic_batches(products: list[dict]) -> list[list[dict]]:
    batches = []
    current_batch = []
    current_tokens = SYSTEM_PROMPT_TOKENS

    for product in products:
        product_tokens = (
            estimate_tokens(product["title"]) +
            estimate_tokens(product["description"]) +
            JSON_OVERHEAD_PER_ITEM
        )
        output_reserve = (len(current_batch) + 1) * OUTPUT_TOKENS_PER_ITEM
        token_overflow = (current_tokens + product_tokens + output_reserve) > INPUT_TOKEN_BUDGET
        count_overflow = len(current_batch) >= MAX_PRODUCTS_PER_BATCH

        if token_overflow or count_overflow:
            if current_batch:
                batches.append(current_batch)
            current_batch = [product]
            current_tokens = SYSTEM_PROMPT_TOKENS + product_tokens
        else:
            current_batch.append(product)
            current_tokens += product_tokens

    if current_batch:
        batches.append(current_batch)

    return batches


# ---------------------------------------------------------
# Description Cache
# ---------------------------------------------------------
_description_cache: dict[int, list[str]] = {}

def get_cache_key(product: dict) -> int:
    return hash(product["title"].strip() + product["description"].strip())


# ---------------------------------------------------------
# OpenRouter API Call
# ---------------------------------------------------------
async def _call_openrouter_api(items: list[dict], batch_index: int) -> dict[str, list[str]]:
    input_json = json.dumps(items, ensure_ascii=True)
    dynamic_max_tokens = max(1024, len(items) * OUTPUT_TOKENS_PER_ITEM + 500)

    for attempt in range(MAX_RETRIES):
        try:
            response = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Tag these products:\n{input_json}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=dynamic_max_tokens
            )

            raw = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason

            if finish_reason == "length":
                logging.warning(
                    f"Batch {batch_index}: Output truncated. "
                    f"max_tokens={dynamic_max_tokens} may be too low for {len(items)} products."
                )

            parsed = safe_json_loads(raw)
            results = parsed.get("results", [])
            tagged = {
                item["handle"]: item.get("tags", [])
                for item in results
                if "handle" in item
            }

            logging.info(
                f"Batch {batch_index}: {len(tagged)}/{len(items)} handles tagged ✅ "
                f"(finish={finish_reason})"
            )
            return tagged

        except json.JSONDecodeError as e:
            logging.error(f"Batch {batch_index}: JSON repair failed (attempt {attempt+1}/{MAX_RETRIES}): {e}")
            await asyncio.sleep(5)

        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "429" in error_str or "rate limit" in error_str or "exhausted" in error_str

            retry_after = None
            if hasattr(e, "response") and e.response is not None:
                retry_after = e.response.headers.get("Retry-After")

            if retry_after:
                wait_time = int(retry_after) + 2
                logging.warning(
                    f"Batch {batch_index}: 429 Retry-After={retry_after}s. "
                    f"Waiting {wait_time}s... (attempt {attempt+1}/{MAX_RETRIES})"
                )
            elif is_rate_limit:
                wait_time = RATE_LIMIT_BASE_WAIT * (attempt + 1)
                logging.warning(
                    f"Batch {batch_index}: Rate limit. "
                    f"Waiting {wait_time}s... (attempt {attempt+1}/{MAX_RETRIES})"
                )
            else:
                wait_time = 2 ** attempt
                logging.warning(
                    f"Batch {batch_index}: Error — {e}. "
                    f"Waiting {wait_time}s... (attempt {attempt+1}/{MAX_RETRIES})"
                )

            await asyncio.sleep(wait_time)

    logging.error(f"Batch {batch_index}: FAILED after {MAX_RETRIES} attempts. Will retry on next run.")
    return {}


# ---------------------------------------------------------
# Process Batch
# ---------------------------------------------------------
async def process_batch(batch: list[dict], semaphore: asyncio.Semaphore, batch_index: int) -> dict[str, list[str]]:
    results: dict[str, list[str]] = {}
    need_api = []

    for product in batch:
        key = get_cache_key(product)
        if key in _description_cache:
            results[product["handle"]] = _description_cache[key]
        else:
            need_api.append(product)

    cache_hits = len(batch) - len(need_api)
    if cache_hits:
        logging.info(f"Batch {batch_index}: {cache_hits} products from description cache.")

    if need_api:
        async with semaphore:
            api_results = await _call_openrouter_api(need_api, batch_index)

            if api_results:
                logging.info(f"Batch {batch_index}: Cooldown {POST_SUCCESS_DELAY}s...")
                await asyncio.sleep(POST_SUCCESS_DELAY)

        for product in need_api:
            key = get_cache_key(product)
            tags = api_results.get(product["handle"], [])
            _description_cache[key] = tags
            results[product["handle"]] = tags

    return results


# ---------------------------------------------------------
# Checkpoint Save
# ---------------------------------------------------------
def save_checkpoint(all_tagged: dict[str, list[str]], df_full: pd.DataFrame):
    df_full["generated_tags"] = df_full["Handle"].map(
        lambda h: json.dumps(all_tagged.get(str(h), []))
    )
    df_full.to_csv(OUTPUT_CSV, index=False)
    logging.info(f"Checkpoint saved: {len(all_tagged)} handles tagged so far.")


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------
async def main():
    if not os.path.exists(INPUT_CSV):
        logging.error(f"Input file not found: {INPUT_CSV}")
        return

    df = pd.read_csv(INPUT_CSV)
    logging.info(f"Loaded {len(df)} total rows from {INPUT_CSV}")

    product_df = df[
        df["Title"].notna() & (df["Title"].astype(str).str.strip() != "")
    ].drop_duplicates(subset=["Handle"]).copy()
    logging.info(f"Found {len(product_df)} unique products to tag")

    already_tagged: dict[str, list[str]] = {}
    if os.path.exists(OUTPUT_CSV):
        existing = pd.read_csv(OUTPUT_CSV)
        if "generated_tags" in existing.columns and "Handle" in existing.columns:
            for _, row in existing.dropna(subset=["Handle", "generated_tags"]).iterrows():
                tags_val = str(row["generated_tags"])
                if tags_val not in ("[]", "nan", ""):
                    try:
                        parsed = json.loads(tags_val)
                        if parsed:
                            already_tagged[str(row["Handle"])] = parsed
                    except (json.JSONDecodeError, TypeError):
                        pass
            logging.info(f"Checkpoint: {len(already_tagged)} handles already tagged, skipping.")

    to_process = []
    for _, row in product_df.iterrows():
        handle = str(row["Handle"])
        if handle in already_tagged:
            continue
        to_process.append({
            "handle": handle,
            "title": str(row.get("Title", "")).strip(),
            "description": sanitize_description(row.get("Body (HTML)", ""))
        })

    if not to_process:
        logging.info("All products already tagged. Nothing to do.")
    else:
        batches = build_dynamic_batches(to_process)
        total_batches = len(batches)
        est_runtime_mins = total_batches * 2

        logging.info(f"Smart batching: {len(to_process)} products → {total_batches} batches")
        logging.info(f"Model: {MODEL_NAME}")
        logging.info(f"Estimated runtime: ~{est_runtime_mins} minutes")

        for i, b in enumerate(batches):
            est_tokens = SYSTEM_PROMPT_TOKENS + sum(
                estimate_tokens(p["title"]) + estimate_tokens(p["description"]) + JSON_OVERHEAD_PER_ITEM
                for p in b
            )
            dyn_max = max(1024, len(b) * OUTPUT_TOKENS_PER_ITEM + 500)
            logging.info(f"  Batch {i}: {len(b)} products | ~{est_tokens:,} in tokens | max_tokens={dyn_max:,}")

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        tasks = [
            asyncio.create_task(process_batch(b, semaphore, i))
            for i, b in enumerate(batches)
        ]

        completed = 0
        for coro in asyncio.as_completed(tasks):
            batch_result = await coro
            already_tagged.update(batch_result)
            completed += 1
            save_checkpoint(already_tagged, df.copy())
            logging.info(f"Progress: {completed}/{total_batches} batches done. ~{total_batches - completed} remaining.")

    df["generated_tags"] = df["Handle"].map(
        lambda h: json.dumps(already_tagged.get(str(h), []))
    )
    df.to_csv(OUTPUT_CSV, index=False)
    logging.info(f"Done ✅ — {len(already_tagged)} unique products tagged across {len(df)} rows.")


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())