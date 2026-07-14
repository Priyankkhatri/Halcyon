# Serving the Fine-Tuned Model locally in Ollama

Follow these steps to serve your newly trained model (`halcyon-llama3.2-3b`) locally via Ollama and connect it to Halcyon:

### 1. Export the Model to GGUF Format
Run the helper script we created. This will load the base model, merge the fine-tuned LoRA adapters, quantize the model to 4-bit (`q4_k_m`), and output a single GGUF file:

```bash
.\ft_venv\Scripts\python.exe backend/finetuning/export_gguf.py
```
This will generate a `.gguf` file inside `models/halcyon-llama3.2-3b-gguf/`.

---

### 2. Create the Ollama Model
1. Create a text file named `Modelfile` inside `models/halcyon-llama3.2-3b-gguf/` with the following content:
   ```dockerfile
   FROM ./unsloth.Q4_K_M.gguf

   # Set standard parameters
   PARAMETER temperature 0.2
   PARAMETER stop "<|im_start|>"
   PARAMETER stop "<|im_end|>"
   PARAMETER stop "<|end_of_text|>"

   # Set System Prompt
   SYSTEM """You are Halcyon AI — an expert Site Reliability Engineer (SRE) specializing in log analysis and incident root-cause diagnosis. Analyze the provided log content and return a structured JSON response."""
   ```
2. Open a terminal, navigate to the `models/halcyon-llama3.2-3b-gguf/` directory, and run the model creation command:
   ```bash
   ollama create halcyon-llama3.2-3b -f Modelfile
   ```

---

### 3. Run and Serve the Model
Start the Ollama server and serve the model:
```bash
ollama run halcyon-llama3.2-3b
```
By default, Ollama will run an OpenAI-compatible API server at `http://localhost:11434`.

---

### 4. Enable in Halcyon Backend
The local variables are already added and enabled in your local `backend/.env` file:
```env
OLLAMA_ENABLED=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=halcyon-llama3.2-3b
```
Once your Ollama model is running, the Halcyon backend will automatically route all incident log diagnostic requests directly to your local fine-tuned model!
