# Stable Diffusion Feature 

In the stable-diffusion-webui folder I have a script

Here's what I wrote for you at `/Users/jon/stable-diffusion-webui/generate.py`. It's a single self-contained script with three input modes:

### Usage

```bash
# Inline JSON (the common case — just your overrides, defaults fill the rest)
python generate.py '{"prompt": "a cat in space, oil painting", "seed": 42, "steps": 25}'

# With LoRAs — just put them in the prompt like normal
python generate.py '{"prompt": "portrait photo <lora:epiCRealism:0.8>, detailed eyes", "cfg_scale": 5}'

# From a saved JSON file
python generate.py @my_preset.json

# From stdin (pipe from another tool)
echo '{"prompt": "hello world"}' | python generate.py -

# Different output directory
python generate.py '{"prompt": "a cat"}' --output-dir ./batch_run_01

# Switch model on the fly
python generate.py '{"prompt": "a cat"}' --model "v1-5-pruned-emaonly"

# Generate without saving files (just get the metadata JSON)
python generate.py '{"prompt": "a cat"}' --no-save
```

### What the JSON output looks like

All status/progress goes to **stderr**. Only the metadata JSON goes to **stdout**, so you can pipe it cleanly:

```json
{
  "input": { "prompt": "a cat in space", "seed": 42 },
  "parameters": {
    "prompt": "a cat in space",
    "negative_prompt": "",
    "seed": 42,
    "sampler_name": "Euler a",
    "steps": 20,
    "cfg_scale": 7.0,
    "width": 512,
    "height": 512,
    "clip_skip": 1,
    "denoising_strength": null,
    "enable_hr": false,
    ...
  },
  "model": {
    "name": "v1-5-pruned-emaonly",
    "hash": "cc6cb27103",
    "vae_name": "auto",
    "vae_hash": "..."
  },
  "images": [
    {
      "index": 0,
      "seed": 42,
      "prompt": "a cat in space",
      "negative_prompt": "",
      "infotext": "a cat in space\nSteps: 20, Sampler: Euler a, ...",
      "file": {
        "filepath": "/Users/jon/stable-diffusion-webui/outputs/headless/..._00_42.png",
        "filename": "..._00_42.png",
        "size_bytes": 524288,
        "sha256": "abc123..."
      }
    }
  ],
  "extra_generation_params": { "Lora hashes": "epiCRealism: abc123" },
  "infotexts": ["...full PNG infotext..."],
  "performance": { "elapsed_seconds": 3.42, "images_generated": 1 },
  "version": "1.9.4",
  "job_timestamp": "20240101120000"
}
```

### Design decisions

- **Your JSON only needs overrides** — sensible defaults (Euler a, 20 steps, cfg 7, 512×512, etc.) fill everything else
- **All human-readable output → stderr**, all machine-readable output → stdout — so `python generate.py '...' > result.json` just works
- **`clip_skip`** is handled as a top-level param even though internally it's an `override_setting`
- **Unknown keys** get a warning but don't crash, so forward-compat is fine
- **SHA256 hash** of each output image is included for integrity tracking / dedup
- **`input` vs `parameters`** — `input` is exactly what you passed in, `parameters` is what was actually used after defaults/expansion (useful for debugging "why does this look different")
- **Per-image metadata** — if you do `batch_size > 1`, each image gets its own seed/prompt/infotext entry
- **The infotext** is the same string that gets embedded in the PNG metadata — so you have full reproducibility info