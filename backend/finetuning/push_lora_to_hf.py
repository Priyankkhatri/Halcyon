import os
from huggingface_hub import HfApi

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
LORA_DIR = os.path.join(ROOT_DIR, "models", "halcyon-llama3.2-3b-lora")

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

    if not os.path.exists(LORA_DIR):
        print(f"\n[ERROR] Trained LoRA directory not found at: {LORA_DIR}")
        return

    repo_id = f"{username}/halcyon-llama3.2-3b-lora"
    print(f"\nCreating Hugging Face Model Repository: {repo_id} (100% Free)...")
    
    try:
        api.create_repo(
            repo_id=repo_id,
            repo_type="model",
            private=False,
            exist_ok=True
        )
        print("Model repository created/verified successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to create repository: {e}")
        return

    print(f"\nUploading trained LoRA adapter files to Hugging Face Hub ({repo_id})...")
    try:
        api.upload_folder(
            folder_path=LORA_DIR,
            repo_id=repo_id,
            repo_type="model"
        )
        print("\n" + "="*50)
        print("UPLOAD SUCCESSFUL!")
        print(f"Hugging Face Model Repository: https://huggingface.co/{repo_id}")
        print("="*50)
        print("\nYour fine-tuned model is now stored in the cloud for free!")
        
    except Exception as e:
        print(f"\n[ERROR] Upload failed: {e}")

if __name__ == "__main__":
    main()
