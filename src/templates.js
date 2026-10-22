export const ENTRY_TEMPLATES = [
  {
    id: "character",
    name: "Character",
    description: "Appearance, personality, history, and relationships.",
    title: "New character",
    keys: ["character name"],
    content: "## Appearance\n\n## Personality\n\n## Background\n\n## Relationships\n"
  },
  {
    id: "location",
    name: "Location",
    description: "A place with atmosphere, landmarks, and hidden details.",
    title: "New location",
    keys: ["location name"],
    content: "## Overview\n\n## Atmosphere\n\n## Notable places\n\n## Secrets\n"
  },
  {
    id: "faction",
    name: "Faction",
    description: "Goals, structure, and relationships with other groups.",
    title: "New faction",
    keys: ["faction name"],
    content: "## Overview\n\n## Goals\n\n## Structure\n\n## Relations\n"
  },
  {
    id: "item",
    name: "Item",
    description: "An object with history, powers, and an owner.",
    title: "New item",
    keys: ["item name"],
    content: "## Description\n\n## History\n\n## Powers\n\n## Owner\n"
  },
  {
    id: "event",
    name: "Event",
    description: "A pivotal moment with causes, participants, and fallout.",
    title: "New event",
    keys: ["event name"],
    content: "## Summary\n\n## Causes\n\n## Participants\n\n## Aftermath\n"
  }
];

export function getEntryTemplate(id) {
  return ENTRY_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function buildTemplatePatch(template) {
  if (!template) {
    return null;
  }

  return {
    title: template.title,
    keys: [...template.keys],
    content: template.content
  };
}
