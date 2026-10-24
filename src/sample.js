import { createProject } from "./schema.js";

export function createSampleProject() {
  return createProject({
    books: [
      {
        name: "Aurora Vale",
        description: "A storm-worn coastal city, its tide-readers, and the secrets beneath the harbor.",
        extensions: { sample: true },
        entries: [
          {
            title: "Aurora Vale",
            keys: ["aurora vale", "the vale", "city"],
            content: "Aurora Vale clings to the cliffs above the Cerulean Reach, its terraced streets lit by thousands of glass lanterns. The city is ruled by a council of tide-readers who chart the ocean's moods from the Brass Observatory. At dusk, the harbor bells ring twice: once for the returning fleet, and once for the things that follow it home.",
            constant: true,
            order: 100
          },
          {
            title: "Mara Voss",
            keys: ["mara", "mara voss", "harbormaster"],
            secondaryKeys: ["the harbormaster", "she"],
            content: "Mara Voss is the harbormaster of Aurora Vale, a weathered woman in her fifties with a lantern-scarred left hand and a voice like gravel. She trusts charts more than people and keeps a private log of every ship that enters the Reach. Mara knows the old routes beneath the city, and she has never explained why she sealed the eastern gate.",
            selective: true,
            order: 110
          },
          {
            title: "Tidebinding",
            keys: ["tidebinding", "tide magic", "tide-song"],
            content: "Tidebinding is the practice of persuading the sea to hold a shape. Practitioners carve sigils into sea glass and hum a low, repeating note until the water answers. The craft is legal within the Vale but heavily taxed; unlicensed tidebinders are called drifters and are banished beyond the Breakwater.",
            order: 120
          }
        ]
      }
    ]
  });
}
