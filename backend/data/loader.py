"""
Halcyon Backend — Local Data Loader
Reads local synthetic incidents from incidents.json and provides a simple
keyword-based similarity search for the hackathon demo without network calls.
"""
import json
import os
import re
from typing import List, Dict

# Path to the local JSON file
DATA_DIR = os.path.dirname(__file__)
INCIDENTS_FILE = os.path.join(DATA_DIR, "incidents.json")

def load_incidents() -> List[Dict]:
    """
    Read the incidents from the local JSON file.
    Returns a list of incident dictionaries.
    """
    if not os.path.exists(INCIDENTS_FILE):
        return []
        
    with open(INCIDENTS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def _extract_keywords(text: str) -> set:
    """Extract lowercase alphabetic words from text for simple matching."""
    text = str(text).lower()
    words = re.findall(r'[a-z]+', text)
    # Filter out common stop words to improve matching quality
    stop_words = {"error", "warn", "info", "the", "a", "an", "and", "in", "on", "at", "to", "for"}
    return set(w for w in words if w not in stop_words and len(w) > 2)

def find_similar_incidents(current_logs: str, top_k: int = 3) -> List[Dict]:
    """
    Does a simple keyword/tag overlap similarity match against the loaded incidents.
    Returns the top_k most similar incidents.
    
    NOTE: This is a temporary local solution. The next step replaces this with 
    actual Hindsight semantic memory retrieval.
    """
    all_incidents = load_incidents()
    if not all_incidents:
        return []
        
    current_keywords = _extract_keywords(current_logs)
    if not current_keywords:
        return []
        
    scored_incidents = []
    
    for inc in all_incidents:
        # Combine logs, root cause, and tags into a single text blob for the incident
        inc_text = " ".join(inc.get("raw_logs", [])) + " " + \
                   inc.get("root_cause", "") + " " + \
                   " ".join(inc.get("tags", []))
                   
        inc_keywords = _extract_keywords(inc_text)
        
        # Jaccard similarity (intersection over union)
        intersection = len(current_keywords.intersection(inc_keywords))
        union = len(current_keywords.union(inc_keywords))
        
        score = intersection / union if union > 0 else 0
        
        if score > 0:
            # Create a copy so we can attach the score
            scored_inc = inc.copy()
            scored_inc["_similarity_score"] = round(score, 3)
            scored_incidents.append(scored_inc)
            
    # Sort descending by score
    scored_incidents.sort(key=lambda x: x["_similarity_score"], reverse=True)
    
    return scored_incidents[:top_k]
