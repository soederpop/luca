# Stable Diffusion Feature 

Stable Diffusion WebUi exposes an API.  Would be great to be able to silently start that service from within JavaScript and be able to generate images, if running locally, or connect to a running instance (e.g. on runpod).

## KeyPoints

- With claude code we could extract what we need directly from StableDiffusionWebui's codebase and not have an API at all for the limited things we want to do.
- Want to be able to pass in minimal parameters by using a layered concept that includes canned prompt words and lora injections
- Want to interact with it as a Javascript object.  Can use python cross communication or whatever we need to be able to do this

## Motivation

- To be able to generate stable diffusion images with Lora models from civitai
- Use StableDiffusion generation as a way for the AGIContainer to express itself

## Status

Currently I've used claude code to create a script in the stable-diffusion-webui repo to generate an image from the CLI.

