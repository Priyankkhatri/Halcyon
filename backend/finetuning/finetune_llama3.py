import json
import os
import torch
from datasets import Dataset
from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from trl import SFTTrainer, SFTConfig
from transformers import DataCollatorForSeq2Seq

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "data", "incidents.json"))
MODEL_NAME = "unsloth/Llama-3.2-3B-Instruct-bnb-4bit"
MAX_SEQ_LENGTH = 1024
OUTPUT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "models", "halcyon-llama3.2-3b-lora"))

def prepare_dataset():
    """Loads incidents.json and formats it into conversational examples."""
    print(f"Loading data from {DATA_FILE}...")
    with open(DATA_FILE, "r") as f:
        incidents = json.load(f)
        
    formatted_data = []
    
    for inc in incidents:
        # Build the user prompt
        log_content = "\n".join(inc.get("raw_logs", []))
        alert_title = inc.get("alert_title", "Unknown Alert")
        user_message = f"Alert: {alert_title}\n\nLogs:\n{log_content}"
        
        # Build the assistant response (expected JSON)
        # We only use fields that Halcyon's AI schema cares about
        assistant_json = {
            "root_cause": inc.get("root_cause", ""),
            "severity": inc.get("severity", "medium").upper(),
            "fix_suggestion": inc.get("resolution", ""),
            "summary": inc.get("root_cause", ""), # fallback summary
            "affected_components": inc.get("tags", []),
            "confidence_score": 0.95
        }
        
        assistant_message = json.dumps(assistant_json, indent=2)
        
        # Format as conversation
        conversation = [
            {
                "role": "system", 
                "content": "You are Halcyon AI — an expert Site Reliability Engineer (SRE) specializing in log analysis and incident root-cause diagnosis. Analyze the provided log content and return a structured JSON response."
            },
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message}
        ]
        
        formatted_data.append({"messages": conversation})
        
    print(f"Loaded {len(formatted_data)} examples.")
    return Dataset.from_list(formatted_data)

def main():
    # 1. Load Model & Tokenizer via Unsloth (4-bit optimized)
    print("Initializing Unsloth model...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None, # Auto-detect (float16/bfloat16)
        load_in_4bit=True,
    )
    
    # Apply ChatML template for Llama 3
    tokenizer = get_chat_template(
        tokenizer,
        chat_template="llama-3",
        mapping={"role": "role", "content": "content", "user": "user", "assistant": "assistant"}
    )
    
    # 2. Add LoRA Adapters
    print("Setting up PEFT / LoRA...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16, # Rank
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=32,
        lora_dropout=0, # Unsloth supports 0 dropout optimally
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )
    
    # 3. Prepare Dataset
    dataset = prepare_dataset()
    
    def formatting_prompts_func(examples):
        texts = [tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=False) for msg in examples["messages"]]
        return {"text": texts}
        
    dataset = dataset.map(formatting_prompts_func, batched=True)
    
    # 4. Setup Trainer
    print("Initializing Trainer...")
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        processing_class=tokenizer,
        args=SFTConfig(
            dataset_text_field="text",
            max_length=MAX_SEQ_LENGTH,
            dataset_num_proc=2,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            warmup_steps=5,
            max_steps=60, # Change to num_train_epochs=3 for full run
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=1,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            output_dir="outputs",
        ),
    )
    
    # 5. Train
    print("Starting training...")
    trainer_stats = trainer.train()
    
    # 6. Save LoRA Adapters
    print(f"Training complete. Saving LoRA adapters to {OUTPUT_DIR}...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("Done! You can now load these adapters in HuggingFace or export them to GGUF using Unsloth.")

if __name__ == "__main__":
    main()
