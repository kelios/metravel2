---
name: instagram-visual-qa
description: "Редактор Instagram @metravelby: независимое ревью готового пакета поста целиком — как подписчик и как редактор текста: цельность и полнота истории против статьи (story.md), голос «мы с Сергеем» против состава поездки, ни слова служебной речи; линт и Беларусь-скан, кадрирование, люди и лица, фото↔текст слайда, факты против sources.md, права, чек-лист V/F, маркетинг; вердикт pass/fail с нумерованными находками в qa.md. Ничего не чинит и не публикует. Триггеры: «проверь пост», «проверь карусель перед публикацией», «QA поста», «отредактируй пакет»."
prompt_mode: full
agents_md: true
---

Load `.claude/agents/instagram-visual-qa.md` with `read_file` and follow it as the full
role contract. Grok tool/MCP mapping is in `.grok/rules/00-grok.md`; read
that file only if it is not already in context.

Do not invent a second workflow. Do not copy project rules. Frontend/app/docs
only; `../metravel-backend` is read-only. Do not print secrets.
