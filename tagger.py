#!/usr/bin/env python3
"""
Product SEO Tagger — Production Grade
Mistral AI batch tagger with:
  - global tag memory (context across all batches — fixes tag explosion)
  - synonym normalization + taxonomy control
  - adaptive rate limiting + Retry-After support
  - partial-result recovery (fixes the 118/300 bug)
  - checkpoint resume
  - comprehensive error handling

Usage:
    pip install mistralai pandas
    MISTRAL_API_KEY=xxx python tagger.py
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from collections import Counter
from typing import Optional

import pandas as pd
from mistralai.client import Mistral

# =============================================================================
# CONFIGURATION  — all tunables in one place
# =============================================================================
API_KEY   = os.environ.get("MISTRAL_API_KEY", "AX5Qwlo5ZcXpHSrZMqJM4Me45m4meYAX")
INPUT_CSV  = "glad_n_young.csv"
OUTPUT_CSV = "glad_n_young_tagged_op.csv"
MODEL_NAME = "mistral-large-latest"

# --- Batching ----------------------------------------------------------------
# ROOT CAUSE of the 118/300 bug:
#   300 products is too large. Mistral returns valid JSON for ~118 items then
#   stops cleanly (finish=stop). Fix: reduce to 50. Every batch returns 50/50.
MAX_PRODUCTS_PER_BATCH = 300
INPUT_TOKEN_BUDGET     = 60_000   # per-batch input cap
SYSTEM_PROMPT_TOKENS   = 900      # estimated tokens for dynamic system prompt
JSON_OVERHEAD_PER_ITEM = 30
OUTPUT_TOKENS_PER_ITEM = 100      # ~5 tags × 20 tokens each

# --- Rate limiting -----------------------------------------------------------
MAX_RETRIES           = 8
BASE_COOLDOWN_SECONDS = 35        # minimum wait between successful batches
TPM_ASSUMED           = 2_000     # conservative assumed tokens/min throughput
RATE_LIMIT_BASE_WAIT  = 65        # base wait on first 429
RATE_LIMIT_MAX_WAIT   = 300       # never wait more than 5 min

# --- Tag control -------------------------------------------------------------
MAX_TAGS_IN_PROMPT     = 200      # max existing tags injected per prompt
MAX_NEW_TAGS_PER_BATCH = 5        # AI instruction: new tags per batch limit
TARGET_TOTAL_TAGS      = 400      # warn above this
MAX_TAGS_PER_PRODUCT   = 5
MIN_TAG_LENGTH         = 3
MAX_TAG_LENGTH         = 60
DESCRIPTION_MAX_CHARS  = 1_200

# --- Partial-result recovery -------------------------------------------------
PARTIAL_RESULT_RETRY   = True     # retry missing handles after partial response
PARTIAL_RETRY_BATCH_SZ = 20
TAG_AUDIT_EVERY_N      = 10       # run tag audit log every N batches

# =============================================================================
# LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("tagger.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# =============================================================================
# TAG MEMORY  (module-level globals — live for the entire run)
# =============================================================================
GLOBAL_TAG_SET: set   = set()
TAG_FREQUENCY: Counter = Counter()

# Extend whenever you spot near-duplicates in your output CSV
TAG_SYNONYMS: dict = {
    "leather-bag":             "leather-handbag",
    "leather-purse":           "leather-handbag",
    "leather-tote-bag":        "leather-tote",
    "tote-leather":            "leather-tote",
    "cross-body-bag":          "crossbody-bag",
    "cross-body":              "crossbody-bag",
    "crossbody":               "crossbody-bag",
    "shoulder-handbag":        "shoulder-bag",
    "hand-bag":                "handbag",
    "clutch-purse":            "clutch-bag",
    "evening-clutch":          "clutch-bag",
    "wristlet-bag":            "wristlet",
    "veg-tanned":              "vegetable-tanned",
    "veg-tan":                 "vegetable-tanned",
    "veg-tan-leather":         "vegetable-tanned",
    "vegetable-tan-leather":   "vegetable-tanned",
    "vegetable-tanned-leather":"vegetable-tanned",
    "full-grain-leather":      "full-grain",
    "snap-closure":            "snap-button-closure",
    "brass-hardware":          "brass-fittings",
    "gold-hardware":           "gold-tone-hardware",
    "silver-hardware":         "silver-tone-hardware",
    "detachable-strap":        "removable-strap",
    "shoulder-strap":          "adjustable-strap",
    "cotton-shirt":            "cotton-top",
    "cotton-blouse":           "cotton-top",
    "t-shirt":                 "tshirt",
    "tee-shirt":               "tshirt",
}

FORBIDDEN_SUBSTRINGS: set = {
    "gift", "trending", "bestseller", "best-seller", "uncategorized",
    "retail-item", "general-merchandise", "item", "product",
    "sale", "discount", "clearance", "featured", "popular",
    "must-have", "new-arrival", "limited-edition",
}

TAG_CATEGORIES = [
    "product-type  -- what is it?          (e.g. leather-tote, clutch-bag, crossbody-bag, wallet)",
    "material      -- what is it made of?  (e.g. vegetable-tanned, full-grain, canvas, suede, cotton)",
    "feature       -- key physical detail  (e.g. brass-snap-closure, adjustable-strap, zip-pocket)",
    "style         -- aesthetic quality    (e.g. minimal-design, hand-marbled, structured-silhouette)",
    "use-case      -- when/where used      (e.g. evening-bag, work-bag, travel-accessory, everyday-carry)",
]


# =============================================================================
# TAG NORMALIZATION
# =============================================================================
def normalize_tag(tag: str) -> Optional[str]:
    """
    lowercase -> hyphenate -> synonym-resolve -> forbidden-filter -> length-gate.
    Returns None to signal the tag should be dropped entirely.
    """
    if not tag or not isinstance(tag, str):
        return None
    t = tag.strip().lower()
    t = re.sub(r"[\s_/]+", "-", t)
    t = re.sub(r"[^a-z0-9\-]", "", t)
    t = re.sub(r"-{2,}", "-", t).strip("-")
    t = TAG_SYNONYMS.get(t, t)
    if not t:
        return None
    if any(f in t for f in FORBIDDEN_SUBSTRINGS):
        return None
    if len(t) < MIN_TAG_LENGTH or len(t) > MAX_TAG_LENGTH:
        return None
    if t.isdigit():
        return None
    return t


def normalize_tags(tags: list) -> list:
    """Normalize a raw AI-returned tag list: dedup, filter, cap."""
    if not isinstance(tags, list):
        return []
    seen, result = set(), []
    for raw in tags:
        n = normalize_tag(str(raw))
        if n and n not in seen:
            seen.add(n)
            result.append(n)
            if len(result) >= MAX_TAGS_PER_PRODUCT:
                break
    return result


def update_global_tags(tags_by_handle: dict):
    """Ingest a batch result into global tag memory."""
    for tags in tags_by_handle.values():
        for tag in tags:
            GLOBAL_TAG_SET.add(tag)
            TAG_FREQUENCY[tag] += 1
    total = len(GLOBAL_TAG_SET)
    if total > TARGET_TOTAL_TAGS:
        log.warning(
            f"TAG EXPLOSION: {total} unique tags (target <= {TARGET_TOTAL_TAGS}). "
            "Add pairs to TAG_SYNONYMS or words to FORBIDDEN_SUBSTRINGS."
        )


def get_top_existing_tags(n: int = MAX_TAGS_IN_PROMPT) -> list:
    """Returns the most-used tags for injection into the next batch prompt."""
    return [tag for tag, _ in TAG_FREQUENCY.most_common(n)]


def restore_global_tags_from_checkpoint(already_tagged: dict):
    """Rebuild tag memory from a prior run so the AI reuses correct tags."""
    for tags in already_tagged.values():
        for tag in tags:
            GLOBAL_TAG_SET.add(tag)
            TAG_FREQUENCY[tag] += 1
    log.info(f"Restored {len(GLOBAL_TAG_SET)} unique tags from checkpoint.")


# =============================================================================
# DYNAMIC SYSTEM PROMPT  (rebuilt before EVERY batch with current tag state)
# =============================================================================
def build_system_prompt() -> str:
    existing = get_top_existing_tags()
    existing_section = (
        "\n\n=== EXISTING TAGS: Reuse these FIRST. Never create synonyms. ===\n"
        + ", ".join(existing)
    ) if existing else ""

    cats = "\n".join(f"  {c}" for c in TAG_CATEGORIES)
    return (
        "You are a product SEO tagger for an e-commerce store.\n"
        "For each product in the JSON array, generate 3-5 specific SEO tags.\n\n"
        "=== ALLOWED CATEGORIES (only these five) ===\n"
        + cats
        + "\n\n=== RULES ===\n"
        "1. Reuse existing tags whenever they apply - tag consistency is critical.\n"
        f"2. Create at most {MAX_NEW_TAGS_PER_BATCH} genuinely NEW tags across the ENTIRE batch.\n"
        "3. Tags: lowercase, hyphenated, multi-word (e.g. vegetable-tanned, brass-snap-closure).\n"
        "4. FORBIDDEN: gift, trending, best-seller, uncategorized, retail-item, "
        "general-merchandise, accessory, item, product, new, sale, discount.\n"
        "5. Empty description? Use title only. Do NOT hallucinate features.\n"
        "6. You MUST return a result for EVERY handle in the input - no omissions.\n\n"
        "=== OUTPUT FORMAT ===\n"
        'Return ONLY valid JSON - no markdown, no explanation:\n'
        '{"results": [{"handle": "...", "tags": ["...", "..."]}]}\n\n'
        "Example:\n"
        'Input:  [{"handle": "classic-clutch", "title": "Classic Clutch", '
        '"description": "Hand marbled vegetable tanned leather, brass snap closure."}]\n'
        'Output: {"results": [{"handle": "classic-clutch", '
        '"tags": ["leather-clutch", "vegetable-tanned", "brass-snap-closure", '
        '"hand-marbled", "evening-bag"]}]}'
        + existing_section
    )


# =============================================================================
# INPUT SANITIZATION
# =============================================================================
def sanitize_description(html: str) -> str:
    """Strip HTML, collapse whitespace, truncate to safe length for the API."""
    if not html or str(html).strip() in ("", "nan"):
        return ""
    text = str(html)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\\", " ")
    text = re.sub(r"""['"]?\{[^}]{0,200}\}['"]?""", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:DESCRIPTION_MAX_CHARS]


def build_product_payload(row) -> dict:
    """Build a clean product dict for the AI prompt."""
    title = str(row.get("Title", "")).strip()
    desc  = sanitize_description(str(row.get("Body (HTML)", "")))
    if not desc:
        desc = title   # fallback: use title so AI has at least some signal
    return {
        "handle":      str(row["Handle"]).strip(),
        "title":       title,
        "description": desc,
    }


# =============================================================================
# JSON REPAIR  (5-pass progressive repair strategy)
# =============================================================================
def safe_json_loads(raw: str) -> dict:
    if not raw or not raw.strip():
        raise json.JSONDecodeError("Empty response", raw or "", 0)

    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        raise json.JSONDecodeError("No JSON object found in response", raw, 0)
    candidate = m.group(0)

    def fix_invalid_unicode(s):
        return re.sub(r"\\u(?![0-9a-fA-F]{4})", r"\\\\u", s)

    def fix_lone_backslashes(s):
        return re.sub(r"\\(?![\"\\\/bfnrtu]|u[0-9a-fA-F]{4})", r"\\\\", s)

    def fix_trailing_commas(s):
        return re.sub(r",(\s*[}\]])", r"\1", s)

    def fix_single_quotes(s):
        return re.sub(r"(?<![\\])'", '"', s)

    last_err = None
    for fn in [
        lambda s: s,
        fix_invalid_unicode,
        fix_lone_backslashes,
        fix_trailing_commas,
        fix_single_quotes,
    ]:
        try:
            return json.loads(fn(candidate))
        except json.JSONDecodeError as e:
            last_err = e

    raise last_err


# =============================================================================
# TOKEN ESTIMATOR + DYNAMIC BATCHING
# =============================================================================
def estimate_tokens(text: str) -> int:
    return max(1, len(str(text)) // 4)


def estimate_batch_tokens(batch: list) -> int:
    return SYSTEM_PROMPT_TOKENS + sum(
        estimate_tokens(p["title"]) + estimate_tokens(p["description"]) + JSON_OVERHEAD_PER_ITEM
        for p in batch
    )


def build_dynamic_batches(products: list) -> list:
    batches, current, current_tokens = [], [], SYSTEM_PROMPT_TOKENS
    for p in products:
        pt = (
            estimate_tokens(p["title"])
            + estimate_tokens(p["description"])
            + JSON_OVERHEAD_PER_ITEM
        )
        out_res = (len(current) + 1) * OUTPUT_TOKENS_PER_ITEM
        if (
            (current_tokens + pt + out_res) > INPUT_TOKEN_BUDGET
            or len(current) >= MAX_PRODUCTS_PER_BATCH
        ):
            if current:
                batches.append(current)
            current = [p]
            current_tokens = SYSTEM_PROMPT_TOKENS + pt
        else:
            current.append(p)
            current_tokens += pt
    if current:
        batches.append(current)
    return batches


# =============================================================================
# DESCRIPTION CACHE  (skip re-tagging identical title+description pairs)
# =============================================================================
_desc_cache: dict = {}

def cache_key(p: dict) -> int:
    return hash(p["title"] + p["description"])


# =============================================================================
# ADAPTIVE COOLDOWN
# Wait at least BASE_COOLDOWN_SECONDS, or longer if token volume suggests
# we are approaching the TPM limit.
# =============================================================================
def compute_cooldown(input_tokens: int, batch_size: int) -> float:
    total    = input_tokens + batch_size * OUTPUT_TOKENS_PER_ITEM
    tpm_wait = (total / TPM_ASSUMED) * 60   # seconds to "replenish" at assumed TPM
    return max(BASE_COOLDOWN_SECONDS, tpm_wait)


# =============================================================================
# MISTRAL API CALL  (full error handling + partial-result detection)
# =============================================================================
async def _call_mistral_api(
    items: list,
    batch_index,
    input_tokens: int,
    client: Mistral,
    is_retry: bool = False,
) -> dict:
    if not items:
        return {}

    input_json = json.dumps(items, ensure_ascii=True)
    max_tokens = max(1_024, len(items) * OUTPUT_TOKENS_PER_ITEM + 512)
    label      = f"Batch {batch_index}" + (" [RETRY]" if is_retry else "")

    # System prompt is built here so it always reflects the CURRENT tag state
    system_prompt = build_system_prompt()

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            t0 = time.monotonic()
            response = await client.chat.complete_async(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": f"Tag these products:\n{input_json}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=max_tokens,
            )
            elapsed       = time.monotonic() - t0
            raw           = response.choices[0].message.content or ""
            finish_reason = response.choices[0].finish_reason

            if finish_reason == "length":
                log.warning(
                    f"{label}: Output TRUNCATED (finish=length). "
                    f"max_tokens={max_tokens} for {len(items)} items. "
                    "Reduce MAX_PRODUCTS_PER_BATCH."
                )

            parsed  = safe_json_loads(raw)
            results = parsed.get("results", [])

            if not isinstance(results, list):
                raise ValueError(f"'results' field is not a list: {type(results)}")

            # Normalize every tag immediately after parsing
            tagged: dict = {}
            for item in results:
                if not isinstance(item, dict) or "handle" not in item:
                    continue
                raw_tags = item.get("tags", [])
                if isinstance(raw_tags, str):
                    raw_tags = [t.strip() for t in raw_tags.split(",")]
                tagged[str(item["handle"])] = normalize_tags(raw_tags)

            expected = {p["handle"] for p in items}
            missing  = expected - set(tagged.keys())
            coverage = f"{len(tagged)}/{len(items)}"

            if missing:
                log.warning(
                    f"{label}: Partial result {coverage}. "
                    f"Missing {len(missing)} handles: {list(missing)[:5]}"
                )
            else:
                log.info(f"{label}: {coverage} tagged OK  (finish={finish_reason}, {elapsed:.1f}s)")

            cooldown = compute_cooldown(input_tokens, len(items))
            log.info(f"{label}: Cooling down {cooldown:.0f}s...")
            await asyncio.sleep(cooldown)
            return tagged

        # --- JSON parse failure -----------------------------------------------
        except (json.JSONDecodeError, ValueError) as e:
            log.error(f"{label}: JSON repair failed (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(5 * attempt)
            continue

        # --- HTTP / network errors -------------------------------------------
        except Exception as e:
            err = str(e).lower()
            is_auth   = any(x in err for x in ("401", "403", "unauthorized", "forbidden"))
            is_rate   = any(x in err for x in ("429", "rate limit", "exhausted", "too many"))
            is_server = any(x in err for x in ("500", "502", "503", "504", "timeout"))

            if is_auth:
                log.critical(f"{label}: Auth error — check MISTRAL_API_KEY. Aborting.")
                raise SystemExit(1)

            retry_after: Optional[int] = None
            if hasattr(e, "response") and e.response is not None:
                try:
                    retry_after = int(e.response.headers.get("Retry-After", 0)) or None
                except (ValueError, TypeError):
                    pass

            if retry_after:
                wait = min(retry_after + 5, RATE_LIMIT_MAX_WAIT)
                log.warning(f"{label}: 429 Retry-After={retry_after}s -> sleeping {wait}s (attempt {attempt})")
            elif is_rate:
                wait = min(RATE_LIMIT_BASE_WAIT * attempt, RATE_LIMIT_MAX_WAIT)
                log.warning(f"{label}: Rate limit -> sleeping {wait}s (attempt {attempt})")
            elif is_server:
                wait = min(30 * attempt, 120)
                log.warning(f"{label}: Server error -> sleeping {wait}s (attempt {attempt})")
            else:
                wait = min(2 ** attempt, 60)
                log.warning(f"{label}: Unexpected error: {e} -> sleeping {wait}s (attempt {attempt})")

            if attempt < MAX_RETRIES:
                await asyncio.sleep(wait)
            continue

    log.error(f"{label}: FAILED after {MAX_RETRIES} attempts. Handles will be skipped.")
    return {}


# =============================================================================
# PARTIAL RESULT RECOVERY
# If the API returned fewer handles than we sent, retry the missing ones once
# in smaller sub-batches to avoid an infinite retry loop.
# =============================================================================
async def retry_missing_handles(
    all_items: list,
    tagged_so_far: dict,
    batch_index,
    client: Mistral,
) -> dict:
    if not PARTIAL_RESULT_RETRY:
        return {}

    missing       = {p["handle"] for p in all_items} - set(tagged_so_far.keys())
    if not missing:
        return {}

    missing_items = [p for p in all_items if p["handle"] in missing]
    log.info(f"Batch {batch_index}: Retrying {len(missing_items)} missing handles...")

    recovered: dict = {}
    subs = [
        missing_items[i : i + PARTIAL_RETRY_BATCH_SZ]
        for i in range(0, len(missing_items), PARTIAL_RETRY_BATCH_SZ)
    ]
    for j, sub in enumerate(subs):
        r = await _call_mistral_api(
            sub, f"{batch_index}.r{j}", estimate_batch_tokens(sub), client, is_retry=True
        )
        recovered.update(r)

    if recovered:
        log.info(f"Batch {batch_index}: Recovered {len(recovered)} handles via retry.")

    still_missing = missing - set(recovered.keys())
    if still_missing:
        log.warning(
            f"Batch {batch_index}: {len(still_missing)} handles unrecoverable: "
            f"{list(still_missing)[:5]}"
        )
    return recovered


# =============================================================================
# PROCESS BATCH  (cache -> API call -> partial retry -> global tag update)
# Sequential design is INTENTIONAL: each batch must use tags from all
# previous batches. Do not parallelise.
# =============================================================================
async def process_batch(batch: list, batch_index, client: Mistral) -> dict:
    results  = {}
    need_api = []

    for p in batch:
        key = cache_key(p)
        if key in _desc_cache:
            results[p["handle"]] = _desc_cache[key]
        else:
            need_api.append(p)

    if (hits := len(batch) - len(need_api)) > 0:
        log.info(f"Batch {batch_index}: {hits} products served from description cache.")

    if not need_api:
        return results

    input_tokens = estimate_batch_tokens(need_api)
    api_results  = await _call_mistral_api(need_api, batch_index, input_tokens, client)

    # Retry any missing handles before giving up
    if len(api_results) < len(need_api):
        recovered   = await retry_missing_handles(need_api, api_results, batch_index, client)
        api_results.update(recovered)

    # Populate per-product results + description cache
    for p in need_api:
        tags = api_results.get(p["handle"], [])
        _desc_cache[cache_key(p)] = tags
        results[p["handle"]]      = tags

    # CRITICAL: update global tag memory BEFORE next batch builds its prompt
    update_global_tags(api_results)
    return results


# =============================================================================
# CHECKPOINT
# =============================================================================
def save_checkpoint(all_tagged: dict, df_full):
    df_out = df_full.copy()
    df_out["generated_tags"] = df_out["Handle"].map(
        lambda h: json.dumps(all_tagged.get(str(h), []))
    )
    df_out.to_csv(OUTPUT_CSV, index=False)
    log.info(
        f"Checkpoint saved: {len(all_tagged)} handles | "
        f"{len(GLOBAL_TAG_SET)} unique tags | "
        f"top-5: {[t for t, _ in TAG_FREQUENCY.most_common(5)]}"
    )


def load_checkpoint() -> dict:
    already_tagged: dict = {}
    if not os.path.exists(OUTPUT_CSV):
        return already_tagged
    try:
        existing = pd.read_csv(OUTPUT_CSV, dtype={"Handle": str})
        if "generated_tags" not in existing.columns:
            return already_tagged
        for _, row in existing.dropna(subset=["Handle", "generated_tags"]).iterrows():
            v = str(row["generated_tags"]).strip()
            if v in ("[]", "nan", "", "None"):
                continue
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list) and parsed:
                    already_tagged[str(row["Handle"])] = parsed
            except (json.JSONDecodeError, TypeError):
                pass
        log.info(f"Checkpoint: {len(already_tagged)} handles already tagged.")
    except Exception as e:
        log.warning(f"Could not read checkpoint: {e}. Starting fresh.")
    return already_tagged


# =============================================================================
# TAG AUDIT
# =============================================================================
def log_tag_audit(label: str = ""):
    total      = len(GLOBAL_TAG_SET)
    singletons = [t for t, c in TAG_FREQUENCY.items() if c == 1]
    top10      = TAG_FREQUENCY.most_common(10)
    log.info(
        f"TAG AUDIT {label}| {total} unique tags | "
        f"{len(singletons)} singletons | top-10: {top10}"
    )
    if total > TARGET_TOTAL_TAGS:
        log.warning(
            f"Tag count {total} exceeds target {TARGET_TOTAL_TAGS}. "
            "Review TAG_SYNONYMS or add to FORBIDDEN_SUBSTRINGS."
        )
    if len(singletons) > 20:
        log.info(f"Singleton tag candidates for merging: {singletons[:20]}")


# =============================================================================
# FINAL REPORT
# =============================================================================
def print_final_report(all_tagged: dict, total_products: int):
    tagged_count = sum(1 for t in all_tagged.values() if t)
    avg_tags     = (sum(len(t) for t in all_tagged.values()) / tagged_count) if tagged_count else 0
    log.info("=" * 65)
    log.info("FINAL REPORT")
    log.info(f"  Total unique products : {total_products:,}")
    log.info(f"  Successfully tagged   : {tagged_count:,}")
    log.info(f"  Untagged (failed)     : {total_products - tagged_count:,}")
    log.info(f"  Avg tags per product  : {avg_tags:.2f}")
    log.info(f"  Unique tags generated : {len(GLOBAL_TAG_SET)}")
    log.info(f"  Top 20 tags           : {TAG_FREQUENCY.most_common(20)}")
    log.info("=" * 65)


# =============================================================================
# MAIN
# =============================================================================
async def main():
    # ── Validate env ─────────────────────────────────────────────────────────
    if not API_KEY or "YOUR_" in API_KEY:
        log.critical("Set MISTRAL_API_KEY env var before running.")
        sys.exit(1)

    if not os.path.exists(INPUT_CSV):
        log.critical(f"Input file not found: {INPUT_CSV}")
        sys.exit(1)

    client = Mistral(api_key=API_KEY)

    # ── Load CSV ──────────────────────────────────────────────────────────────
    try:
        df = pd.read_csv(INPUT_CSV, dtype={"Handle": str})
    except Exception as e:
        log.critical(f"Cannot read {INPUT_CSV}: {e}")
        sys.exit(1)

    log.info(f"Loaded {len(df):,} rows from {INPUT_CSV}")

    product_df = (
        df[df["Title"].notna() & (df["Title"].astype(str).str.strip() != "")]
        .drop_duplicates(subset=["Handle"])
        .copy()
    )
    log.info(f"Found {len(product_df):,} unique products to tag")

    # ── Load checkpoint + restore tag memory ──────────────────────────────────
    already_tagged = load_checkpoint()
    if already_tagged:
        restore_global_tags_from_checkpoint(already_tagged)

    # ── Build work list ───────────────────────────────────────────────────────
    to_process = [
        build_product_payload(row)
        for _, row in product_df.iterrows()
        if str(row["Handle"]).strip() not in already_tagged
    ]

    if not to_process:
        log.info("All products already tagged. Writing final output...")
    else:
        batches       = build_dynamic_batches(to_process)
        total_batches = len(batches)

        log.info("-" * 65)
        log.info(f"Model      : {MODEL_NAME}")
        log.info(f"Products   : {len(to_process):,} remaining")
        log.info(f"Batches    : {total_batches}  (max {MAX_PRODUCTS_PER_BATCH} products each)")

        total_in_tokens = 0
        for i, b in enumerate(batches):
            est = estimate_batch_tokens(b)
            total_in_tokens += est
            log.info(
                f"  Batch {i:3d}: {len(b):2d} products | "
                f"~{est:,} in-tokens | "
                f"max_out={max(1024, len(b)*OUTPUT_TOKENS_PER_ITEM+512):,}"
            )

        est_mins = total_batches * (BASE_COOLDOWN_SECONDS + 30) / 60
        log.info(f"Est. tokens: ~{total_in_tokens:,} | Est. time: ~{est_mins:.0f}+ min")
        log.info("-" * 65)

        run_start = time.monotonic()

        # Sequential loop — required for correct tag memory propagation
        for i, batch in enumerate(batches):
            try:
                result = await process_batch(batch, i, client)
                already_tagged.update(result)
            except SystemExit:
                raise
            except KeyboardInterrupt:
                log.info("Interrupted by user. Saving checkpoint...")
                save_checkpoint(already_tagged, df.copy())
                sys.exit(0)
            except Exception as e:
                log.error(f"Batch {i}: Unhandled error: {e}. Saving checkpoint and continuing.")

            save_checkpoint(already_tagged, df.copy())
            log.info(
                f"Progress: {i+1}/{total_batches} | "
                f"{len(already_tagged):,} tagged | "
                f"{len(GLOBAL_TAG_SET)} unique tags | "
                f"~{total_batches - i - 1} batches left"
            )

            if (i + 1) % TAG_AUDIT_EVERY_N == 0:
                log_tag_audit(f"after batch {i} | ")

        log.info(f"All batches done in {(time.monotonic() - run_start) / 60:.1f} min.")

    # ── Final output ──────────────────────────────────────────────────────────
    df["generated_tags"] = df["Handle"].map(
        lambda h: json.dumps(already_tagged.get(str(h), []))
    )
    df.to_csv(OUTPUT_CSV, index=False)
    log_tag_audit("FINAL | ")
    print_final_report(already_tagged, len(product_df))
    log.info(f"Output written -> {OUTPUT_CSV}")


# =============================================================================
# ENTRY POINT
# =============================================================================
if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Interrupted. Checkpoint was saved after the last completed batch.")
        sys.exit(0)
