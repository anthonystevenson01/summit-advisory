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
    id: "persona",
    num: "02",
    name: "Buyer Persona Quality Check",
    tagline: "See whether your buyer persona is specific enough to actually drive sales decisions.",
    outputDescription: "Letter grade, overall score, 6 scored dimensions, biggest gap, key question to answer.",
    surface: "#0a1a14",
    accent: "#319A65",
  },
  {
    id: "problem",
    num: "03",
    name: "Market Problem Validator",
    tagline: "Stress-test whether the problem you're solving is real, urgent, and worth building against.",
    outputDescription: "Verdict, score, 6 scored dimensions, next validation moves, the question you're avoiding.",
    surface: "#0a1a14",
    accent: "#319A65",
  },
  {
    id: "positioning",
    num: "04",
    name: "Positioning Statement Grader",
    tagline: "Find out if your positioning statement actually works — or just sounds good.",
    outputDescription: "Letter grade (A–F), overall score, 6 scored dimensions, suggested rewrite if needed.",
    surface: "#0a1a14",
    accent: "#319A65",
  },
  {
    id: "moat",
    num: "05",
    name: "Competitive Moat Rater",
    tagline: "Understand how defensible your position really is — and what threatens it.",
    outputDescription: "Moat rating (Strong / Moderate / Thin / Exposed), score, 6 dimensions, 90-day priority.",
    surface: "#0a1a14",
    accent: "#319A65",
  },
];
