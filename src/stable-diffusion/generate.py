#!/usr/bin/env python3
"""
Minimal headless image generation for stable-diffusion-webui.

Usage:
    # From the stable-diffusion-webui directory:
    python generate.py '{
        "prompt": "a cat in a space suit, oil painting",
        "negative_prompt": "ugly, blurry",
        "seed": 42,
        "steps": 20,
        "cfg_scale": 7.0,
        "width": 512,
        "height": 512
    }'

    # Or with LoRAs (just include them in the prompt):
    python generate.py '{
        "prompt": "a portrait <lora:epiCRealism:0.8>, detailed eyes",
        "seed": -1
    }'

    # Or pipe JSON in:
    echo '{"prompt": "hello world"}' | python generate.py -

    # Or point to a JSON file:
    python generate.py @params.json

Output:
    - Image(s) saved to ./outputs/ (or custom --output-dir)
    - JSON metadata printed to stdout for piping/logging
"""

import argparse
import hashlib
import json
import os
import sys
import time


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description="Generate images with stable-diffusion-webui (no server needed)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate.py '{"prompt": "a cat", "seed": 42}'
  python generate.py @my_params.json
  echo '{"prompt": "hello"}' | python generate.py -
  python generate.py '{"prompt": "a cat"}' --output-dir ./my_images
        """,
    )
    parser.add_argument(
        "params",
        nargs="?",
        default=None,
        help='JSON string, @filename.json, or - for stdin',
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="outputs/headless",
        help="Directory to save images (default: outputs/headless)",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Don't save images to disk (metadata still printed)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Checkpoint name to load (e.g. 'v1-5-pruned-emaonly')",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List available checkpoints and exit",
    )
    parser.add_argument(
        "--list-loras",
        action="store_true",
        help="List available LoRAs and exit",
    )
    parser.add_argument(
        "--list-samplers",
        action="store_true",
        help="List available sampler names and exit",
    )
    return parser


def parse_input_params(raw):
    """Parse JSON params from string, file reference, or stdin."""
    if raw is None or raw == "-":
        if sys.stdin.isatty() and raw is None:
            print("Error: No parameters provided. Pass JSON, @file.json, or pipe to stdin.", file=sys.stderr)
            print("       Run with --help for usage examples.", file=sys.stderr)
            sys.exit(1)
        raw = sys.stdin.read().strip()

    if raw.startswith("@"):
        filepath = raw[1:]
        if not os.path.isfile(filepath):
            print(f"Error: File not found: {filepath}", file=sys.stderr)
            sys.exit(1)
        with open(filepath, "r") as f:
            raw = f.read()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Defaults — the stuff you rarely change lives here so your JSON stays small
# ---------------------------------------------------------------------------
DEFAULTS = {
    "prompt": "",
    "negative_prompt": "",
    "seed": -1,
    "subseed": -1,
    "subseed_strength": 0,
    "steps": 20,
    "cfg_scale": 7.0,
    "width": 512,
    "height": 512,
    "sampler_name": "Euler a",
    "scheduler": None,
    "batch_size": 1,
    "n_iter": 1,
    "restore_faces": False,
    "tiling": False,
    "enable_hr": False,
    "denoising_strength": 0.75,
    "hr_scale": 2.0,
    "hr_upscaler": "Latent",
    "hr_second_pass_steps": 0,
    "hr_resize_x": 0,
    "hr_resize_y": 0,
    "hr_checkpoint_name": None,
    "hr_sampler_name": None,
    "hr_scheduler": None,
    "hr_prompt": "",
    "hr_negative_prompt": "",
    "styles": [],
    "override_settings": None,
    "eta": None,
    "s_churn": None,
    "s_tmax": None,
    "s_tmin": None,
    "s_noise": None,
    "clip_skip": None,
    "refiner_checkpoint": None,
    "refiner_switch_at": None,
}

# Keys from DEFAULTS that are valid StableDiffusionProcessingTxt2Img params
# (clip_skip is handled separately via override_settings)
PROCESSING_KEYS = set(DEFAULTS.keys()) - {"clip_skip"}


def sha256_file(filepath):
    """Quick hash of the output image for integrity/dedup tracking."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def init_webui():
    """Run the full webui initialization (model load, samplers, extensions, etc.)."""
    t0 = time.time()
    print("Initializing stable-diffusion-webui...", file=sys.stderr)

    from modules import initialize

    initialize.imports()
    print(f"  imports:      {time.time() - t0:.1f}s", file=sys.stderr)

    initialize.initialize()
    print(f"  initialized:  {time.time() - t0:.1f}s", file=sys.stderr)

    # initialize() already calls initialize_rest(), but the model is loaded
    # in a background thread. We need to force it to finish before we proceed.
    from modules import shared
    _ = shared.sd_model  # blocks until the model is loaded
    print(f"  model loaded: {time.time() - t0:.1f}s", file=sys.stderr)

    return shared


def list_models():
    """Print all available checkpoints as JSON to stdout."""
    from modules import sd_models
    models = []
    for title, info in sd_models.checkpoints_list.items():
        models.append({
            "title": info.title,
            "name": info.name,
            "name_for_extra": info.name_for_extra,
            "model_name": info.model_name,
            "hash": info.hash,
            "shorthash": info.shorthash,
            "sha256": info.sha256,
            "filename": info.filename,
            "is_safetensors": info.is_safetensors,
        })
    print(json.dumps(models, indent=2))


def list_loras():
    """Print all available LoRAs as JSON to stdout."""
    try:
        from extensions_builtin.Lora import networks
        networks.list_available_networks()
        loras = []
        for name, net in sorted(networks.available_networks.items()):
            loras.append({
                "name": name,
                "alias": net.alias,
                "filename": net.filename,
                "hash": net.hash,
                "shorthash": net.shorthash,
                "sd_version": str(net.sd_version) if net.sd_version else None,
                "is_safetensors": net.is_safetensors,
            })
        print(json.dumps(loras, indent=2))
    except ImportError:
        print(json.dumps({"error": "LoRA extension not loaded"}))


def list_samplers():
    """Print all available sampler names as JSON to stdout."""
    from modules import sd_samplers
    samplers = []
    for s in sd_samplers.all_samplers:
        samplers.append({
            "name": s.name,
            "aliases": s.aliases,
        })
    print(json.dumps(samplers, indent=2))


def switch_model(shared, model_name):
    """Switch to a different checkpoint by name."""
    from modules import sd_models

    info = sd_models.get_closet_checkpoint_match(model_name)
    if info is None:
        available = list(sd_models.checkpoints_list.keys())
        print(f"Error: Model '{model_name}' not found.", file=sys.stderr)
        print(f"       Available: {available}", file=sys.stderr)
        sys.exit(1)

    current = getattr(shared.sd_model, "sd_checkpoint_info", None)
    if current and current.name == info.name:
        print(f"  Model already loaded: {info.name}", file=sys.stderr)
        return

    print(f"  Switching model to: {info.name}...", file=sys.stderr)
    sd_models.reload_model_weights(info=info)


def generate(shared, params):
    """
    Run txt2img generation and return (images, metadata_dict).

    params: dict with any keys from DEFAULTS (unrecognized keys are ignored with a warning).
    """
    from contextlib import closing
    from modules.processing import StableDiffusionProcessingTxt2Img, process_images
    from modules import scripts

    # Merge with defaults
    merged = {**DEFAULTS, **params}

    # Warn about unrecognized keys
    unknown = set(params.keys()) - set(DEFAULTS.keys())
    if unknown:
        print(f"  Warning: Ignoring unknown params: {unknown}", file=sys.stderr)

    # Handle clip_skip via override_settings
    override_settings = merged.get("override_settings") or {}
    if merged.get("clip_skip") is not None:
        override_settings["CLIP_stop_at_last_layers"] = merged["clip_skip"]
    if override_settings:
        merged["override_settings"] = override_settings

    # Build kwargs for the processing object (only known processing keys)
    proc_kwargs = {k: merged[k] for k in PROCESSING_KEYS if k in merged}
    proc_kwargs["do_not_save_samples"] = True
    proc_kwargs["do_not_save_grid"] = True

    t0 = time.time()

    p = StableDiffusionProcessingTxt2Img(**proc_kwargs)
    p.scripts = scripts.scripts_txt2img
    p.script_args = tuple()

    shared.state.begin(job="txt2img")
    try:
        with closing(p):
            processed = process_images(p)
    finally:
        shared.state.end()

    elapsed = time.time() - t0

    # -----------------------------------------------------------------------
    # Build rich metadata (everything except the pixel data itself)
    # -----------------------------------------------------------------------
    metadata = {
        # --- Input params (what you asked for) ---
        "input": {k: v for k, v in params.items()},

        # --- Resolved params (what was actually used, including defaults) ---
        "parameters": {
            "prompt": processed.prompt,
            "negative_prompt": processed.negative_prompt,
            "seed": processed.seed,
            "subseed": processed.subseed,
            "subseed_strength": processed.subseed_strength,
            "sampler_name": processed.sampler_name,
            "scheduler": getattr(processed, "scheduler", merged.get("scheduler")),
            "steps": processed.steps,
            "cfg_scale": processed.cfg_scale,
            "image_cfg_scale": processed.image_cfg_scale,
            "width": processed.width,
            "height": processed.height,
            "batch_size": processed.batch_size,
            "n_iter": merged.get("n_iter", 1),
            "restore_faces": processed.restore_faces,
            "face_restoration_model": processed.face_restoration_model,
            "tiling": merged.get("tiling", False),
            "enable_hr": merged.get("enable_hr", False),
            "denoising_strength": processed.denoising_strength,
            "hr_scale": merged.get("hr_scale"),
            "hr_upscaler": merged.get("hr_upscaler"),
            "hr_second_pass_steps": merged.get("hr_second_pass_steps"),
            "clip_skip": processed.clip_skip,
            "eta": processed.eta,
            "styles": processed.styles,
            "refiner_checkpoint": merged.get("refiner_checkpoint"),
            "refiner_switch_at": merged.get("refiner_switch_at"),
        },

        # --- Model info ---
        "model": {
            "name": processed.sd_model_name,
            "hash": processed.sd_model_hash,
            "vae_name": processed.sd_vae_name,
            "vae_hash": processed.sd_vae_hash,
        },

        # --- Per-image details (seeds, prompts after style/lora expansion) ---
        "images": [],

        # --- Generation metadata ---
        "performance": {
            "elapsed_seconds": round(elapsed, 2),
            "images_generated": len(processed.images),
        },

        # --- Extra generation params (LoRA weights, hires info, etc.) ---
        "extra_generation_params": processed.extra_generation_params,

        # --- The full infotext strings (same as what's embedded in PNG) ---
        "infotexts": processed.infotexts,

        # --- Software version ---
        "version": processed.version,
        "job_timestamp": processed.job_timestamp,
    }

    # Per-image info
    for i in range(len(processed.images)):
        img_info = {
            "index": i,
            "seed": processed.all_seeds[i] if i < len(processed.all_seeds) else processed.seed,
            "subseed": processed.all_subseeds[i] if i < len(processed.all_subseeds) else processed.subseed,
            "prompt": processed.all_prompts[i] if i < len(processed.all_prompts) else processed.prompt,
            "negative_prompt": (
                processed.all_negative_prompts[i]
                if i < len(processed.all_negative_prompts)
                else processed.negative_prompt
            ),
            "infotext": processed.infotexts[i] if i < len(processed.infotexts) else None,
        }
        metadata["images"].append(img_info)

    return processed.images, metadata


def save_images(images, metadata, output_dir):
    """Save PIL images to disk and add file info to metadata."""
    os.makedirs(output_dir, exist_ok=True)

    timestamp = metadata["job_timestamp"]
    filepaths = []

    for i, img in enumerate(images):
        seed = metadata["images"][i]["seed"]
        filename = f"{timestamp}_{i:02d}_{seed}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath)

        file_info = {
            "filepath": os.path.abspath(filepath),
            "filename": filename,
            "size_bytes": os.path.getsize(filepath),
            "sha256": sha256_file(filepath),
        }
        metadata["images"][i]["file"] = file_info
        filepaths.append(filepath)

        print(f"  Saved: {filepath}", file=sys.stderr)

    return filepaths


def main():
    parser = build_arg_parser()
    args = parser.parse_args()

    listing = args.list_models or args.list_loras or args.list_samplers

    # Set up webui root
    repo_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(repo_root)
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

    # Initialize
    shared = init_webui()

    # Handle --list-* flags (can combine them)
    if listing:
        if args.list_models:
            list_models()
        if args.list_loras:
            list_loras()
        if args.list_samplers:
            list_samplers()
        return

    # Parse user params (only required when actually generating)
    params = parse_input_params(args.params)

    # Optional model switch
    if args.model:
        switch_model(shared, args.model)

    # Generate
    print("Generating...", file=sys.stderr)
    images, metadata = generate(shared, params)

    # Save
    if not args.no_save:
        save_images(images, metadata, args.output_dir)
    else:
        metadata["note"] = "Images were not saved to disk (--no-save)"

    # Output metadata JSON to stdout
    print(json.dumps(metadata, indent=2, default=str))


if __name__ == "__main__":
    main()
