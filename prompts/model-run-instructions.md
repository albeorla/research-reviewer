# Model Run Instructions

Run the research prompt across each enabled model UI in any order. Your goal is several independent, comparable answers — not one merged answer.

## For each model

1. Open the model UI:
   - ChatGPT: https://chatgpt.com/
   - Claude: https://claude.ai/new
   - Gemini: https://gemini.google.com/app
   - DeepSeek: https://chat.deepseek.com/
   - Kimi: https://kimi.com/
2. Start a fresh conversation. Do not resume a prior chat.
3. Paste the enriched research prompt from `01-enriched-research-prompt.md` exactly. Do not edit it, summarise it, or add follow-up prompting.
4. Wait for the full response, including any deep-research / agent expansion the model is configured to do.
5. Copy the entire markdown response.
6. Paste it into the matching slot on the Collect screen, or save it as a file and point the slot at the path.

## Do not

- Edit, summarise, or paraphrase any model's output.
- Mix outputs from different models into a single file.
- Reuse a previous conversation — start fresh each time so the model has no prior context.
- Skip an enabled model. Adversarial review depends on having multiple independent answers (at least two).

## Why multiple models

Models like ChatGPT, Claude, Gemini, DeepSeek, and Kimi cover a wide spread of training data, alignment regimes, and reasoning styles. The downstream critics rely on real disagreement between sources to surface unsupported claims and missed alternatives. The more independent sources you provide, the wider the window the critics see onto the question.
