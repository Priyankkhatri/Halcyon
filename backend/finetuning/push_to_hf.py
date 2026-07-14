import os
import tempfile
import urllib.request
import urllib.parse
import json
from huggingface_hub import HfApi

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
GGUF_PATH = os.path.join(ROOT_DIR, "models", "halcyon-llama3.2-3b-gguf_gguf", "Llama-3.2-3B-Instruct.Q4_K_M.gguf")
RENDER_TOKEN = "rnd_ZwIBk1IaUarpJuL8KTsXhlIT89TC"

def get_render_service_id():
    """Gets the service ID for halcyon-backend on Render."""
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {RENDER_TOKEN}"
    }
    req = urllib.request.Request("https://api.render.com/v1/services?limit=20", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            services = json.loads(resp.read().decode('utf-8'))
            for svc in services:
                if svc["service"]["name"] == "halcyon-backend":
                    return svc["service"]["id"]
    except Exception as e:
        print(f"[Render API] Error fetching services: {e}")
    return None

def update_render_env_vars(service_id, api_url):
    """Updates environment variables on Render and triggers redeployment."""
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {RENDER_TOKEN}"
    }
    
    # 1. Fetch current environment variables
    print("[Render API] Fetching current environment variables...")
    req_get = urllib.request.Request(f"https://api.render.com/v1/services/{service_id}/env-vars", headers=headers)
    try:
        with urllib.request.urlopen(req_get) as resp:
            env_vars = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"[Render API] Error getting env vars: {e}")
        return False

    # Keep track of existing keys to update or preserve them
    existing_vars = {item["envVar"]["key"]: item["envVar"]["value"] for item in env_vars}
    
    # Update or add Ollama config variables
    existing_vars["OLLAMA_ENABLED"] = "true"
    existing_vars["OLLAMA_URL"] = api_url
    existing_vars["OLLAMA_MODEL"] = "halcyon-llama3.2-3b"
    
    payload = [{"key": k, "value": v} for k, v in existing_vars.items()]

    # 2. Update environment variables
    print("[Render API] Updating environment variables on Render...")
    req_put = urllib.request.Request(
        f"https://api.render.com/v1/services/{service_id}/env-vars",
        data=json.dumps(payload).encode('utf-8'),
        headers=headers,
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req_put) as resp:
            print("[Render API] Environment variables updated successfully!")
    except Exception as e:
        print(f"[Render API] Error setting env vars: {e}")
        return False

    # 3. Trigger new deploy
    print("[Render API] Triggering a new Render redeployment...")
    req_deploy = urllib.request.Request(
        f"https://api.render.com/v1/services/{service_id}/deploys",
        data=b"{}",
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req_deploy) as resp:
            print("[Render API] Redeployment triggered successfully!")
            return True
    except Exception as e:
        print(f"[Render API] Error triggering deploy: {e}")
    return False

def main():
    print("Checking Hugging Face credentials...")
    api = HfApi()
    try:
        user_info = api.whoami()
        username = user_info["name"]
        print(f"Logged in as Hugging Face user: {username}")
    except Exception as e:
        print("\n[ERROR] You are not logged in to Hugging Face.")
        print("Please run: hf auth login")
        return

    if not os.path.exists(GGUF_PATH):
        print(f"\n[ERROR] GGUF model file not found at: {GGUF_PATH}")
        return

    repo_id = f"{username}/halcyon-model-server"
    print(f"\nCreating Hugging Face Space: {repo_id} (Gradio SDK)...")
    
    try:
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="gradio",
            private=False,
            exist_ok=True
        )
        print("Space repository created/verified successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to create repository: {e}")
        return

    # requirements.txt file content
    requirements_content = """gradio
fastapi
uvicorn
pydantic
llama-cpp-python>=0.2.70
huggingface_hub
"""

    # app.py file content (mounts Gradio home screen + exposes OpenAI-compatible APIs)
    app_content = """import os
import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from llama_cpp import Llama
import gradio as gr

model_path = "Llama-3.2-3B-Instruct.Q4_K_M.gguf"

print("Loading model...")
llm = Llama(
    model_path=model_path,
    n_ctx=2048,
    n_threads=4,
    chat_format="llama-3"
)
print("Model loaded successfully!")

app = FastAPI(title="Halcyon Model API")

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    temperature = body.get("temperature", 0.2)
    max_tokens = body.get("max_tokens", 512)
    
    try:
        response = llm.create_chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return JSONResponse(content=response)
    except Exception as e:
        print(f"Error: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": "halcyon-llama3.2-3b",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "halcyon"
            }
        ]
    }

def check_status():
    return "Halcyon model server is active and running!"

demo = gr.Interface(
    fn=check_status,
    inputs=[],
    outputs="text",
    title="Halcyon AI Model Server",
    description="This Space serves the fine-tuned Halcyon model for incident diagnostics."
)

app = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
"""

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write requirements.txt
        req_path = os.path.join(tmpdir, "requirements.txt")
        with open(req_path, "w", encoding="utf-8") as f:
            f.write(requirements_content)
        
        # Write app.py
        app_path = os.path.join(tmpdir, "app.py")
        with open(app_path, "w", encoding="utf-8") as f:
            f.write(app_content)

        print("\nUploading requirements.txt and app.py...")
        api.upload_file(
            path_or_fileobj=req_path,
            path_in_repo="requirements.txt",
            repo_id=repo_id,
            repo_type="space"
        )
        api.upload_file(
            path_or_fileobj=app_path,
            path_in_repo="app.py",
            repo_id=repo_id,
            repo_type="space"
        )
        print("Configuration files uploaded.")

    print(f"\nUploading GGUF model (2.02 GB) to {repo_id}...")
    print("This may take several minutes depending on your internet upload speed...")
    try:
        api.upload_file(
            path_or_fileobj=GGUF_PATH,
            path_in_repo="Llama-3.2-3B-Instruct.Q4_K_M.gguf",
            repo_id=repo_id,
            repo_type="space"
        )
        print("\nGGUF model uploaded successfully!")
        
        space_url = f"https://huggingface.co/spaces/{repo_id}"
        api_url = f"https://{username}-halcyon-model-server.hf.space/v1"
        
        print("\n" + "="*50)
        print("DEPLOYMENT SUCCESSFUL!")
        print(f"Hugging Face Space URL: {space_url}")
        print(f"OpenAI-compatible Endpoint: {api_url}")
        print("="*50)
        
        # Automatically update Render!
        render_service_id = get_render_service_id()
        if render_service_id:
            print(f"\n[Render API] Found service ID: {render_service_id}")
            success = update_render_env_vars(render_service_id, api_url)
            if success:
                print("\n[Render API] Render backend is automatically updating to use the new Hugging Face Space model!")
            else:
                print("\n[Render API] Failed to update Render environment variables. Please set them manually.")
        else:
            print("\n[Render API] Could not find 'halcyon-backend' service on Render. Please update manually.")

    except Exception as e:
        print(f"\n[ERROR] Upload failed: {e}")

if __name__ == "__main__":
    main()
