import os
from unsloth import FastLanguageModel

def main():
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    ADAPTER_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "models", "halcyon-llama3.2-3b-lora"))
    GGUF_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "models", "halcyon-llama3.2-3b-gguf"))

    print(f"Loading base model and adapters from {ADAPTER_DIR}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=ADAPTER_DIR,
        max_seq_length=1024,
        dtype=None,
        load_in_4bit=True,
    )

    print(f"Exporting model to GGUF format (q4_k_m) in {GGUF_DIR}...")
    model.save_pretrained_gguf(GGUF_DIR, tokenizer, quantization_method="q4_k_m")
    print("Export complete!")

if __name__ == "__main__":
    main()
