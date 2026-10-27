/**
 * Every visible Project Builder string that is not catalogue data: the
 * hero title, the step headings and ledes, the field labels, hints and
 * placeholders, the assist strip texts and button labels, the checklist
 * wording, the consent line, the confirmation line and the status lines,
 * plus the builder's public path. Pure, no imports. The prototype's wording
 * with the house rules applied: ASCII apostrophes, British spelling, no en or
 * em dash (the catalogue test walks every export).
 */

/**
 * The builder's public path. Every link to the builder is built from this:
 * the resume links in the save, unlock and reminder emails, the delete page's
 * back link, the reset's replaceState, the /tools hub block, the sitemap, the
 * canonical and the top nav item. One constant so the next move is one edit
 * and a test can tie the redirect in next.config.ts to it.
 *
 * Links emailed before October 2026 point at the old address under /tools.
 * They still work only because next.config.ts redirects it here with the
 * query kept; changing this value needs a matching redirect for the old one.
 */
export const PROJECT_BUILDER_PATH = "/project-builder";

export const HERO_TITLE = "Tell us what you want to build.";

export const STEP_HEADINGS: Record<number, { title: string; lede: string }> = {
  1: { title: "The goal", lede: "What you're solving, for whom, and how you'll know it worked." },
  2: { title: "What it does", lede: "The features it needs and what it connects to." },
  3: { title: "Rules and running it", lede: "If you're not sure about any of this, use the suggestions and Summit will check them with you." },
  4: { title: "Make it smarter", lede: "Based on what you've described, here's where AI or automation could earn its place. Add the ones you like. These are starting points, and Summit will check what's realistic." },
  5: { title: "Ready to submit?", lede: "Anthony will read it, shape it into a project brief and send it to you within two working days." },
};

export const START = {
  nameLabel: "What's your project called?",
  nameHint: "A working title is fine. You can change it later.",
  namePlaceholder: "For example: Supplier ordering portal",
  bizTitle: "Tell us about your business",
  bizLede: "Add as much or as little as you like.",
  websiteLabel: "Company website",
  websitePlaceholder: "acme.com",
  notesLabel: "Anything else we should know?",
  notesHint: "What you do, who your customers are, what's frustrating today, what you've tried. Write it like you'd explain it to a colleague.",
  pathTitle: "Where are you starting from?",
  pathLede: "Pick a starting point.",
  docLabel: "Paste your requirements",
  builtLabel: "What exists today, and what's next?",
  docPlaceholder: "Paste the text of your requirements document here",
  builtPlaceholder: "For example: we have a customer portal with login and order history. Next we need approvals and a manager dashboard.",
  fileHint: "Text, Markdown or CSV files can be uploaded. For Word or PDF, copy and paste the text.",
  fileLabel: "Or upload a file",
  fileRejected: "That file type can't be read here. Copy the text and paste it in.",
  fileCut: "The file was cut at 60,000 characters.",
  readDoc: "Read my document",
  readNotes: "Read my notes",
  reading: "Reading. This can take up to a minute.",
  readEmpty: "Paste or upload something first.",
  readFailed: "The read did not finish. You can carry on and fill the steps by hand.",
  ideaLabel: "In a sentence, what do you want to build?",
  ideaPlaceholder: "A portal where our franchisees order stock and see their sales",
  ideaHint: "Stuck? Start from an example and change the words.",
} as const;

export const REPLACE = {
  whatTitle: "What are you replacing?",
  whatLede: "Pick the kind of system, then the one you use.",
  notListedLabel: "Not listed? Type its name",
  notListedPlaceholder: "For example: an in-house Access database",
  useThis: "Use this",
  lookingUp: (name: string) => `Looking up what teams usually use ${name} for.`,
  lookupFailed: "Couldn't look that up, so here's a general set to choose from.",
  partsTitle: (sys: string) => `Which parts of ${sys} do you use?`,
  partsLede: "Tap once for must have, twice for should have, three times for could have, four to remove.",
  selectUsual: "Select what most teams use",
  whyTitle: (sys: string) => `Why move away from ${sys}?`,
  whyLede: "Pick any that apply. They become requirements too.",
  switchTitle: "The switch-over",
  migrate: "Bring our existing data across",
  parallel: "Run both side by side for a while",
  build: "Build my requirements list",
} as const;

export const GOAL = {
  outcomeTitle: "What does good look like?",
  outcomeLede: "Every requirement later on should trace back to these answers.",
  assistWithContext: "We can draft these, and who'll use it, from what you've told us. We only fill blanks, never overwrite.",
  assistWithout: "Tell us about your business or idea on the first step and we can draft these for you.",
  assistButton: "Draft these for me",
  problemLabel: "What problem are you solving?",
  problemPlaceholder: "Orders are taken by phone and keyed into three systems. Errors cost us about 40 hours a month.",
  audienceLabel: "Who has the problem?",
  audiencePlaceholder: "Our 60 franchise owners and the head office ops team",
  successLabel: "How will you know it worked?",
  successHint: "A number and a timeframe beats a feeling.",
  successPlaceholder: "Order errors down by half within three months of launch",
  signoffLabel: "Who signs off the scope?",
  signoffPlaceholder: "Name and role",
  timingLabel: "When do you need it?",
  budgetLabel: "Rough budget",
  peopleTitle: "Who will use it?",
  peopleLede: "Pick everyone who'll touch it, including the people who look after it.",
  roleLabel: "Someone else?",
  rolePlaceholder: "For example: warehouse pickers",
  addRole: "Add user",
} as const;

export const WHAT = {
  featuresTitle: "What does it need to do?",
  featuresLede: "Tap a card to add it, tap again to change its priority.",
  assistText: "We can pick a starting set from what you've told us, with priorities. You change anything that's wrong.",
  assistButton: "Pick a starting set",
  legend: "Once: must have. Twice: should have. Three times: could have. Four times: remove.",
  customLabel: "Something specific to your business?",
  customPlaceholder: "For example: managers approve orders over 5,000",
  add: "Add",
  remove: "Remove",
  builtTag: "From your notes, already built",
  systemTag: (sys: string) => `From your ${sys || "current system"} setup`,
  connectionsTitle: "What does it need to talk to?",
  connectionsLede: "Connections to other systems are where most projects get harder than expected. Better to name them now.",
  connectionsAssist: "We can suggest likely connections from the features you picked.",
  connectionsButton: "Suggest connections",
  otherLabel: "Anything else? Separate with commas.",
  otherPlaceholder: "Our warehouse system, Shopify",
} as const;

export const RULES = {
  guardTitle: "Guardrails",
  guardLede: "The rules it has to live within. Security and IT teams read this part first.",
  guardAssist: "Not sure what applies? We'll suggest what a business like yours usually needs. Check each one before moving on.",
  guardButton: "Suggest what applies",
  applyLabel: "Which of these apply?",
  sso: "Single sign-on",
  perms: "Roles and permissions",
  audit: "Audit trail",
  personal: "Handles personal data",
  standardsLabel: "Standards it must meet",
  residencyLabel: "Where must data be stored?",
  scaleLabel: "How many people will use it?",
  uptimeLabel: "When does it need to be up?",
  runTitle: "Who runs it after launch?",
  runLede: "A project is finished when someone can run, fix and extend it without calling the people who built it.",
  quickQuestion: "Quick question that answers most of this: do you have developers in-house?",
  yes: "Yes",
  some: "One or two",
  no: "No",
  suggestForMe: "Suggest for me",
  skillsLabel: "What does your team already know?",
  skillsHint: "Languages, frameworks, cloud platforms. Leave blank if unsure.",
  skillsPlaceholder: "Python, React, AWS",
  handoverLabel: "What should the handover include?",
} as const;

export const SMART = {
  find: "Find ways to make it smarter",
  findHint: "We'll look at everything you've told us so far and suggest where AI or automation could help.",
  loading: "Looking at what you've described for places AI could help.",
  fresh: "Fresh ideas",
  added: (n: number) => `${n} idea${n > 1 ? "s" : ""} added to your requirements.`,
  nothingAdded: "Nothing added yet. Pick a priority on any idea to add it.",
  limit: "That's the limit on fresh ideas for this brief.",
  human: "Person stays in charge",
  buildsOn: "Builds on:",
  helps: "Why it helps:",
  notForUs: "Not for us",
  commonStart: "Here are some common starting points while the smarter suggestions are unavailable.",
} as const;

export const SUBMIT = {
  addThis: "Add this",
  missing: (n: number) => `${n} essential${n > 1 ? "s" : ""} still blank. You can submit anyway, but the brief will be stronger with ${n > 1 ? "them" : "it"}.`,
  project: "Project",
  users: "Users",
  requirements: "Requirements",
  ideasAdded: "AI ideas added",
  connections: "Connections",
  noneYet: "None yet",
  none: "None",
  submittingAs: "Submitting as",
  change: "Change",
  whoTitle: "Who should we send it to?",
  button: "Submit to Summit",
  submitting: "Sending your brief.",
} as const;

export const CONTACT = {
  name: "Your name",
  email: "Work email",
  company: "Company name",
  website: "Company website",
  websitePlaceholder: "acme.com",
} as const;

export const CONSENT_LINE = "We will use these to send you a link back to your brief, and Anthony may follow up about it.";
export const MARKETING_LABEL = "Send me occasional updates from Summit";
export const FREE_MAIL_PROMPT = "A work email helps us match your company, if you have one.";
export const CONFIRMATION_LINE = "Anthony will read it, shape it into a project brief and send it to you within two working days. If anything needs clarifying, he will be in touch first.";
export const PASTE_NOTICE = "Pasted material is used only to build your brief. It is not used to train models and is deleted after 90 days.";
export const PRIVACY_URL = "mailto:privacy@summitstrategyadvisory.com";
export const PRIVACY_LABEL = "Privacy";
export const SAVED_LOCAL_ONLY_LINE = "Your brief is saved, but the link could not be emailed.";
export const SAVED_LINE = "Saved. We'll email you a link to come back to it.";
export const DETAILS_UPDATED_LINE = "Details updated.";
export const LINK_REQUEST_ANSWER = "If we have a brief for that address, the link is on its way.";
export const FALLBACK_LINE = "The helper is not available just now, so this is the rule based suggestion.";
export const DAILY_LIMIT_LINE = "The helpers have reached today's limit. Fill this step by hand.";
export const SUGGEST_CAP_LINE = "You have used the 30 suggestions for this brief. This is the rule based suggestion.";
export const OFFLINE_LINE = "That did not work just now. You can carry on and fill this step by hand.";
export const WORKING_LINE = "Working on it.";
export const UNDONE_LINE = "Undone.";
export const AUTOSAVE_FAILED_LINE = "Could not save just now; your changes are kept on this device.";
export const SAVE_FAILED_LINE = "Could not save just now. Your brief is still on this device.";
export const LINK_INVALID_LINE = "That link is not valid or has expired. Ask for a fresh one below.";
export const LOCKED_LINE = "This brief has been submitted. Ask to change something from your brief page and Anthony will reopen it.";
export const CHANGE_SENT_LINE = "Sent. Anthony will reopen your brief or reply by email.";

export const SAVE = {
  save: "Save",
  savedAt: (hhmm: string) => `Saved at ${hhmm}`,
  startAgain: "Start again",
  startNew: "Start a new brief",
  confirmReset: "Tap again to clear everything",
  sheetTitleNew: "Save your progress",
  sheetTitleSaved: "Your details",
  sheetLedeNew: "We'll save your brief and email you a link, so you can pick it up on any device.",
  sheetLedeSaved: "Update anything that's changed.",
  cancel: "Cancel",
} as const;

export const LINK_REQUEST = {
  title: "Been here before?",
  lede: "Email me my link to a brief I saved.",
  placeholder: "you@company.com",
  button: "Email me my link",
} as const;

export const DOCK = {
  label: "Your blueprint",
  requirements: (n: number) => `${n} requirement${n === 1 ? "" : "s"}`,
  mustHave: (n: number) => `${n} must have`,
  ready: (pct: number) => `${pct}% ready`,
  open: "Open",
  close: "Close",
  readyToSubmit: "Ready to submit",
  meterLabel: "How complete your brief is",
  must: "must",
  should: "should",
  could: "could",
  aboutBusiness: "About your business",
  edit: "Edit",
  gap: (n: number) => `${n} essential${n > 1 ? "s" : ""} still to answer before you submit.`,
  hint: "Tap any requirement to change its priority or remove it.",
  empty: "Nothing yet. Every answer you give adds to this list.",
  changeOn: (step: string) => `Change on ${step}`,
  remove: "Remove",
  closeDetail: "Close",
} as const;

export const DONE = {
  title: (first: string) => (first ? `Thanks, ${first}. Your brief is with Summit.` : "Thanks. Your brief is with Summit."),
  submitted: "Submitted",
  status: "Status",
  whatYouSent: "What you sent",
  sent: (reqs: number, must: number, roles: number) => `${reqs} requirements (${must} must have), ${roles} user types`,
  changeTitle: "Need to change something?",
  changeLede: "Tell Anthony what you would like to change and he will reopen your brief.",
  changePlaceholder: "What would you like to change?",
  changeButton: "Ask to change something",
  changeTooShort: "Give us a little more detail, at least 10 characters.",
} as const;

export const STEPPER = {
  back: "Back",
  next: "Next",
  backTo: (name: string) => `Back to ${name}`,
  nextTo: (name: string) => `Next: ${name}`,
  stepOf: (n: number, total: number, name: string) => `Step ${n} of ${total}: ${name}`,
  stepLabel: (n: number, name: string) => `Step ${n}: ${name}`,
} as const;

/** The legend colours per source key: fill and stroke. "none" means no fill. */
export const SOURCE_DOTS: Record<string, { fill: string; stroke: string }> = {
  you: { fill: "#319A65", stroke: "#319A65" },
  doc: { fill: "#D6EDE3", stroke: "#D6EDE3" },
  system: { fill: "#4A8E8E", stroke: "#4A8E8E" },
  suggested: { fill: "none", stroke: "#D6EDE3" },
  ai: { fill: "#FFFFFF", stroke: "#FFFFFF" },
};
