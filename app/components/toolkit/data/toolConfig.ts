export interface ToolMeta {
  id: string;
  num: string;
  name: string;
  tagline: string;
  outputDescription: string;
  surface: string;
  accent: string;
}

export const TOOLS: ToolMeta[] = [
  {
    id: "positioning",
    num: "01",
    name: "Positioning Statement Grader",
    tagline: "Find out if your positioning statement actually works — or just sounds good.",
    outputDescription: "Letter grade (A–F), overall score, 6 scored dimensions, suggested rewrite if needed.",
    surface: "#0a1a14",
    accent: "#86efac",
  },
  {
    id: "problem",
    num: "02",
    name: "Market Problem Validator",
    tagline: "Stress-test whether the problem you're solving is real, urgent, and worth building against.",
    outputDescription: "Verdict, score, 6 scored dimensions, next validation moves, the question you're avoiding.",
    surface: "#fafaf7",
    accent: "#fbbf24",
  },
  {
    id: "persona",
    num: "03",
    name: "Persona Quality Check",
    tagline: "See whether your buyer persona is specific enough to actually drive sales decisions.",
    outputDescription: "Letter grade, overall score, 6 scored dimensions, biggest gap, key question to answer.",
    surface: "#F5F9F6",
    accent: "#319A65",
  },
  {
    id: "moat",
    num: "04",
    name: "Competitive Moat Rater",
    tagline: "Understand how defensible your position really is — and what threatens it.",
    outputDescription: "Moat rating (Strong / Moderate / Thin / Exposed), score, 6 dimensions, 90-day priority.",
    surface: "#002030",
    accent: "#34d399",
  },
  {
    id: "account",
    num: "05",
    name: "Account Intelligence",
    tagline: "Get a full sales brief on any target account — signals, contacts, and an opening play.",
    outputDescription: "ICP fit, timing verdict, key contacts with LinkedIn searches, market signals, recommended opening.",
    surface: "#00252e",
    accent: "#67e8f9",
  },
];
