## Purpose

Указатель в конце каталога даёт доступ ко всем ссылкам на страны, города и квесты, занимая компактное место до раскрытия нужного раздела.

## ADDED Requirements

### Requirement: Compact directory sections
The web catalog SHALL present each nonempty directory group as an independently expandable section, initially collapsed, with its existing localized heading visible and an activation target at least 44 CSS pixels high.

#### Scenario: Initial directory on mobile and desktop
- **WHEN** a visitor opens the unfiltered quest catalog and reaches its directory
- **THEN** only the headings of nonempty groups are visible until the visitor expands a group

#### Scenario: Pointer and keyboard activation
- **WHEN** the visitor activates a group heading with a pointer, touch, Enter or Space
- **THEN** that group toggles, other groups keep their state, and the heading retains keyboard focus

### Requirement: Server navigation remains available
The directory SHALL keep its existing link addresses, order, locale and membership in the server document, with the same disclosure behavior with and without JavaScript.

#### Scenario: Navigation without scripts
- **WHEN** JavaScript is disabled and the visitor expands a directory group
- **THEN** the group reveals the links already present in the server document, and those links navigate to their original destinations

#### Scenario: Localized hub
- **WHEN** a visitor opens a language-specific quest hub
- **THEN** its directory retains every existing member link in the hub language

#### Scenario: Empty or filtered catalog
- **WHEN** no directory links exist or the existing catalog rules exclude the directory for a filter or search
- **THEN** no empty disclosure heading or unrelated directory appears
