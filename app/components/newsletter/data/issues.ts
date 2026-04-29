export type BodyBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "pullquote"; text: string }
  | { type: "rule" };

export interface Issue {
  id: string;
  num: string;
  date: string;
  title: string;
  subtitle: string;
  tag: string;
  readTime: string;
  body: BodyBlock[];
}

export const ISSUES: Issue[] = [
  {
    id: "001",
    num: "No. 001",
    date: "April 8, 2026",
    title: "The 400-Account Rule",
    subtitle: "Why treating a finite market like an infinite one is the most expensive mistake in B2B sales.",
    tag: "Market Strategy",
    readTime: "5 min read",
    body: [
      {
        type: "p",
        text: "Most GTM advice is built for companies with thousands of potential customers. Lower your CAC. Increase your conversion rate. Run more outbound. The math works when your market is large enough to absorb the noise. But when your TAM is 400 accounts, noise is fatal.",
      },
      {
        type: "h2",
        text: "The Finite Market Problem",
      },
      {
        type: "p",
        text: "In a finite market, every impression counts. Every email you send to the wrong person, every positioning statement that fails to land, every sales call that ends without a clear value proposition — these aren't small inefficiencies. They're permanent marks against you in accounts you'll need to revisit for years.",
      },
      {
        type: "pullquote",
        text: "When you have 400 accounts, you don't get to burn through them testing messages. You have one reputation, and it travels fast.",
      },
      {
        type: "h2",
        text: "What Changes When Your Market Is Finite",
      },
      {
        type: "p",
        text: "The companies that thrive in finite markets treat GTM like a precision instrument, not a volume game. They know every account by name. Their positioning is specific enough to exclude clearly. Their sales team knows who the real decision-maker is before the first call. This is the mindset this letter is built to develop.",
      },
      {
        type: "rule",
      },
      {
        type: "p",
        text: "Over the coming issues, we'll cover positioning, problem validation, persona quality, competitive defensibility, and account intelligence — all through the lens of teams with fewer than 5,000 potential customers. Welcome to the Scale-Up Letter.",
      },
    ],
  },
  {
    id: "002",
    num: "No. 002",
    date: "April 15, 2026",
    title: "Why Your Positioning Fails at the Door",
    subtitle: "The gap between what you think your positioning says and what a buyer actually hears when they first encounter you.",
    tag: "Positioning",
    readTime: "6 min read",
    body: [
      {
        type: "p",
        text: "Most positioning statements are written to make internal stakeholders feel good. They use words like 'leading', 'innovative', and 'seamless'. They're vague enough to avoid offending anyone. And they're forgotten the moment a buyer closes the browser tab.",
      },
      {
        type: "h2",
        text: "The Positioning Trap",
      },
      {
        type: "p",
        text: "Here's what actually happens when a buyer encounters weak positioning: they pattern-match you to the nearest familiar category, assume you're like everyone else in it, and move on. You never had a chance to prove them wrong.",
      },
      {
        type: "pullquote",
        text: "A positioning statement that applies to ten companies applies to none of them. Specificity isn't a nice-to-have — it's the only way in.",
      },
      {
        type: "h2",
        text: "Six Dimensions That Actually Matter",
      },
      {
        type: "p",
        text: "Strong positioning earns a score on six dimensions: clarity (can they repeat it back?), specificity (does it exclude clearly?), differentiation (is it genuinely different from alternatives?), credibility (does it earn the right to be believed?), emotional resonance (does it connect to something the buyer actually cares about?), and market fit (does it work for a finite-market buyer specifically?).",
      },
      {
        type: "p",
        text: "Most statements fail on specificity first. They describe what the product does, not what outcome it delivers, for whom, in what context, and why it's the better choice. The fix is often simple: make it more exclusive, not more inclusive.",
      },
      {
        type: "rule",
      },
      {
        type: "p",
        text: "Use the Positioning Statement Grader in the Summit GTM Toolkit to test yours against these six dimensions. It'll tell you exactly where you're losing the buyer before you've said a word.",
      },
    ],
  },
  {
    id: "003",
    num: "No. 003",
    date: "April 22, 2026",
    title: "The Persona Problem",
    subtitle: "Why most buyer personas are useless for enterprise sales — and what a good one actually looks like.",
    tag: "Personas",
    readTime: "5 min read",
    body: [
      {
        type: "p",
        text: "The buyer persona document is one of the most reliably useless artefacts in B2B sales. It typically describes a fictional person named 'Enterprise Emily' who 'values efficiency', 'manages a team of 50+', and 'is frustrated by legacy systems'. This tells a sales rep nothing they couldn't have guessed.",
      },
      {
        type: "h2",
        text: "What a Persona Is Actually For",
      },
      {
        type: "p",
        text: "A persona is useful only if it tells your sales team who to prioritise and who to deprioritise before the first conversation. It should make it obvious which accounts to call first, which objections to pre-empt, and which value proposition to lead with. If it doesn't do those things, it's decoration.",
      },
      {
        type: "pullquote",
        text: "A great persona should make it as clear who you're NOT selling to as who you are. Exclusion is a feature, not a bug.",
      },
      {
        type: "h2",
        text: "The Six Dimensions of Persona Quality",
      },
      {
        type: "p",
        text: "We evaluate personas across: specificity (is the job title specific enough to find on LinkedIn?), pain clarity (is the pain specific, costly, and urgent?), decision authority (can this person actually buy?), reachability (can you find and contact them efficiently?), job-to-be-done fit (does your product help them do something they're already trying to do?), and finite market alignment (are there enough of these people to build a company, but few enough that each one matters?).",
      },
      {
        type: "p",
        text: "The most common failure is on decision authority. Teams build personas around people who feel the pain but don't control budget. Selling to the wrong person in a finite market doesn't just waste a call — it permanently colours the relationship with the account.",
      },
      {
        type: "rule",
      },
      {
        type: "p",
        text: "Test your persona against these dimensions in the Persona Quality Check tool. You might be surprised how many boxes you're not ticking.",
      },
    ],
  },
  {
    id: "004",
    num: "No. 004",
    date: "April 29, 2026",
    title: "Moat or Mirage?",
    subtitle: "How to honestly evaluate whether your competitive position is defensible — or whether you're one funded competitor away from serious trouble.",
    tag: "Competitive Strategy",
    readTime: "7 min read",
    body: [
      {
        type: "p",
        text: "Every founder believes they have a moat. Very few actually do. The tell is the language they use: 'our relationships are our moat', 'our team is our moat', 'our culture is our moat'. These are not moats. They are things that are true about most healthy companies and mean nothing to a buyer deciding between you and a well-funded competitor.",
      },
      {
        type: "h2",
        text: "What a Real Moat Looks Like",
      },
      {
        type: "p",
        text: "A real competitive moat makes it costly, painful, or risky for a customer to switch to an alternative. It compounds over time rather than eroding. It's hard to replicate quickly with money. And — critically — it's visible to the buyer, not just to you.",
      },
      {
        type: "pullquote",
        text: "The test of a moat is simple: if a competitor raised $20M tomorrow, would your customers start taking their calls? If the answer is yes, you don't have a moat. You have a head start.",
      },
      {
        type: "h2",
        text: "The Six Moat Dimensions",
      },
      {
        type: "p",
        text: "Strong moats score well across: switching cost (how painful is it to leave?), product differentiation (is there a genuine capability gap?), data and network effects (does the product improve the more customers use it?), brand and relationships (would a customer go out of their way to refer you?), speed of delivery (can you deliver faster than anyone else?), and price defensibility (can you hold price pressure without losing deals?).",
      },
      {
        type: "p",
        text: "In a finite market, brand and relationships carry more weight than they would in a mass market. When your TAM is 400 accounts, being genuinely respected by 50 of them is a meaningful competitive advantage. Word travels. Reputation compounds.",
      },
      {
        type: "h2",
        text: "The 18-Month Question",
      },
      {
        type: "p",
        text: "The honest moat question isn't 'are we winning deals?' — it's 'what would have to be true for us to start losing deals at scale in 18 months?' Running this scenario deliberately, rather than waiting for it to happen, is one of the most valuable exercises a leadership team can do.",
      },
      {
        type: "rule",
      },
      {
        type: "p",
        text: "The Competitive Moat Rater in the Summit GTM Toolkit will score your position across these six dimensions and surface the thing you're probably not saying out loud. It's a useful stress test to run annually.",
      },
    ],
  },
];
