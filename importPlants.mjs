// One-time bulk import script — adds all plants to DynamoDB via the API
// Run with: node importPlants.mjs

import https from "https";

const API = "https://xt71zwxu10.execute-api.us-east-1.amazonaws.com";

// Full plant collection — update as needed
const plants = [
  {
    name: "Dolly",
    species: "Anthurium",
    cultivar: "",
    careInstructions: "Water when top inch is dry. Empty saucer — no wet feet. Bright indirect light.",
    lore: "The glamorous performer who blooms boldly in pink and coral without apology.",
  },
  {
    name: "Stevie Nicks",
    species: "Stromanthe",
    cultivar: "Triostar",
    careInstructions: "Keep consistently moist. Bright indirect light. High humidity. Rotate occasionally.",
    lore: "Wild, bohemian, and utterly her own. Currently going through some drama.",
  },
  {
    name: "Shelob",
    species: "Chlorophytum comosum",
    cultivar: "Bonnie",
    careInstructions: "Allow top half of soil to dry. Medium to bright indirect light. Use filtered water.",
    lore: "Ancient, resilient, and not to be underestimated. Came back from the brink.",
  },
  {
    name: "Thumbelina",
    species: "Unknown",
    cultivar: "",
    careInstructions: "",
    lore: "",
  },
  {
    name: "ZZ Top",
    species: "Zamioculcas zamiifolia",
    cultivar: "",
    careInstructions: "Water thoroughly, allow to dry completely. Low to medium indirect light. Nearly impossible to underwater.",
    lore: "The consummate professional. Effortlessly architectural, completely unbothered.",
  },
  {
    name: "Flora",
    species: "Hypoestes phyllostachya",
    cultivar: "",
    careInstructions: "Keep consistently moist. Bright indirect light. Pinch back leggy stems.",
    lore: "Named for the good fairy in her signature color. Pink, precise, and rather pleased about both.",
  },
  {
    name: "Merryweather",
    species: "Pilea peperomioides",
    cultivar: "",
    careInstructions: "Water when top inch is dry. Rotate weekly for even growth. Bright indirect light.",
    lore: "Grumpy on one side, glorious on the other — exactly as her namesake fairy would be.",
  },
  {
    name: "Briar Rose",
    species: "Tradescantia",
    cultivar: "",
    careInstructions: "Water when top inch is dry. Bright indirect light. Trim regularly. Propagates easily.",
    lore: "Named for Sleeping Beauty's secret name. She was always meant for this pot.",
  },
  {
    name: "Venus",
    species: "Peperomia scandens variegata",
    cultivar: "Cupid",
    careInstructions: "Water when top inch or two is dry. Bright to medium indirect light. Room temperature water only.",
    lore: "Mother of Cupid himself. Arrived with a past but growing into her future one clean leaf at a time.",
  },
  {
    name: "Roberta",
    species: "Nephrolepis cordifolia",
    cultivar: "Lemon Button Fern",
    careInstructions: "Keep consistently moist. Low to medium indirect light. Mist occasionally.",
    lore: "Named with feminine grace for a famously dramatic character. Has claimed the top shelf as her rightful throne.",
  },
  {
    name: "Clair",
    species: "Peperomia",
    cultivar: "Silver",
    careInstructions: "Water when top inch is dry. Medium to bright indirect light. Avoid overwatering.",
    lore: "Named after Clair in Breakfast Club. She is absolutely bougie and knows it.",
  },
  {
    name: "Norma",
    species: "Philodendron",
    cultivar: "Ring of Fire",
    careInstructions: "Water when top inch or two is dry. Grow light essential. Moss pole as she matures.",
    lore: "Named in memory of a mother who sang Ring of Fire during a hospital visit, relating it quietly to herself.",
  },
  {
    name: "Diana",
    species: "Peperomia angulata",
    cultivar: "Beetle Peperomia",
    careInstructions: "Water when top inch or two is dry. Bright indirect light. Less is always more.",
    lore: "Goddess of the hunt, nature, and the moon. Sleek, purposeful, and quietly commanding.",
  },
  {
    name: "Jane",
    species: "Philodendron",
    cultivar: "Birkin",
    careInstructions: "Water when top inch is dry. Grow light essential. Allow to settle after repotting.",
    lore: "Chic, resilient, and currently in her glow-up era. Lost two leaves, immediately grew two more.",
  },
  {
    name: "Rhianna",
    species: "Schefflera",
    cultivar: "Umbrella Plant",
    careInstructions: "Water when top inch or two is dry. Bright indirect light. Prune occasionally.",
    lore: "Graceful and unhurried. She does not demand attention. She simply deserves it.",
  },
  {
    name: "Aurora",
    species: "Anacampseros telephiastrum",
    cultivar: "Sunrise",
    careInstructions: "Water sparingly, allow to dry completely. Direct sun on windowsill. Handle gently.",
    lore: "Her botanical name means return of love. She glows in pink and purple like the sky at the end of a beautiful day.",
  },
  {
    name: "Olaf",
    species: "Cactus",
    cultivar: "Snowman",
    careInstructions: "Water sparingly. Allow to dry completely. Full direct sun. In winter, barely water at all.",
    lore: "Round, stacked, and cheerfully completing the Frozen trio with Elsa and Anna.",
  },
  {
    name: "Marilyn",
    species: "Myrtillocactus geometrizans",
    cultivar: "Boobie Cactus",
    careInstructions: "Water sparingly. Full direct sun. Handle with gloves. Thrives on benign neglect.",
    lore: "She named herself, really. Iconic, impossible to overlook, and entirely comfortable with the attention.",
  },
  {
    name: "Fauna",
    species: "Ficus pumila quercifolia",
    cultivar: "String of Frogs",
    careInstructions: "Keep consistently moist. Bright indirect to gentle morning light. Mist occasionally.",
    lore: "The nature fairy, faithful guardian of her princess. Nearly lost — rescued and nursed back to life.",
  },
  {
    name: "Doris",
    species: "Sansevieria",
    cultivar: "Snake Plant",
    careInstructions: "Water thoroughly, allow to dry completely. Bright indirect light. Nearly indestructible.",
    lore: "Named in loving memory of a favorite mother-in-law. Snake plants live for a very long time. So does love.",
  },
  {
    name: "Dot",
    species: "Peperomia tetraphylla",
    cultivar: "Peperomia Hope",
    careInstructions: "Water when top inch or two is dry. Medium to bright indirect light. Hates soggy roots.",
    lore: "Round, compact, and quietly optimistic. Asks for very little and gives great contentment in return.",
  },
  {
    name: "Andromeda",
    species: "Monstera",
    cultivar: "Thai Constellation",
    careInstructions: "Water when top inch or two is dry. Grow light not optional. Moss pole eventually.",
    lore: "The princess placed among the stars. Unfurls each variegated leaf slowly and deliberately.",
  },
  {
    name: "Xia",
    species: "Chinese Fortune Plant",
    cultivar: "",
    careInstructions: "",
    lore: "",
  },
  {
    name: "Mei Ling",
    species: "Chinese Fortune Plant",
    cultivar: "Variegated Pink",
    careInstructions: "",
    lore: "",
  },
];

// POST each plant to the API
const addPlant = (plant) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(plant);
    const options = {
      hostname: "xt71zwxu10.execute-api.us-east-1.amazonaws.com",
      path: "/plants",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log(`✅ Added: ${plant.name}`);
        resolve(data);
      });
    });

    req.on("error", (err) => {
      console.error(`❌ Failed: ${plant.name}`, err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
};

// Run imports sequentially so we don't hammer the API
const run = async () => {
  console.log("🌿 Starting plant import...\n");
  for (const plant of plants) {
    await addPlant(plant);
  }
  console.log("\n✅ All plants imported!");
};

run();