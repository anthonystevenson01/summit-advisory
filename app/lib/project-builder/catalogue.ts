/**
 * The Project Builder catalogue: the prototype's data as plain typed
 * constants. No imports. Nothing here reads env, Redis or the network, and
 * nothing here is copy for a particular screen (that lives in copy.ts); this
 * is the data the requirements engine, the rule based helpers, the prompts
 * and the page all read.
 *
 * Wording is the prototype's with apostrophes normalised to ASCII. No en or
 * em dash appears in any string; the catalogue test walks every value.
 */

export type PathKey = "doc" | "built" | "idea" | "replace";
export type Priority = "Must" | "Should" | "Could";
export type SourceKey = "you" | "doc" | "system" | "suggested" | "ai";
export type RunKey = "summit" | "team" | "mix" | "unsure";
export type HandoverKey = "docs" | "train" | "repos" | "cloud" | "support";
export type FeatureKey =
  | "accounts"
  | "dashboard"
  | "forms"
  | "workflow"
  | "notify"
  | "search"
  | "content"
  | "files"
  | "payments"
  | "booking"
  | "messaging"
  | "ai"
  | "import"
  | "mobile"
  | "portal";
export type CapabilityKey =
  | "contacts"
  | "pipeline"
  | "quotes"
  | "emailtrack"
  | "campaigns"
  | "forecast"
  | "reports"
  | "tasks"
  | "projects"
  | "timeline"
  | "automations"
  | "forms"
  | "tickets"
  | "sla"
  | "kb"
  | "chat"
  | "inventory"
  | "orders"
  | "purchasing"
  | "invoicing"
  | "ledger"
  | "expenses"
  | "catalogue"
  | "checkout"
  | "promos"
  | "people"
  | "leave"
  | "onboarding"
  | "reviews"
  | "scheduling"
  | "dispatch"
  | "mobilejobs"
  | "docs"
  | "lists"
  | "approvals"
  | "portal"
  | "issues"
  | "roadmap"
  | "shared"
  | "formulas";
export type IdeaKind =
  | "Automate a step"
  | "Summarise or draft"
  | "Sort and route"
  | "Predict"
  | "Answer questions"
  | "Spot problems";
export type IdeaSize = "Quick win" | "Moderate" | "Bigger build";

export interface PathOption {
  key: PathKey;
  title: string;
  body: string;
}

export const PATHS: readonly PathOption[] = [
  { key: "doc", title: "I've got a requirements doc", body: "Paste or upload it. We'll pull out what's in it." },
  { key: "built", title: "Something's partly built", body: "Share notes on what exists and what's next." },
  { key: "idea", title: "I just have an idea", body: "Start with a sentence. We'll help with the rest." },
  { key: "replace", title: "We're replacing a system", body: "Pick what you use today. We'll build the list from it." },
];

export const EXAMPLES: readonly string[] = [
  "A portal where our franchisees order stock and see their sales",
  "An app for field technicians to log jobs, photos and sign-offs",
  "A dashboard that pulls sales data from three systems into one view",
  "A customer onboarding flow with document upload and approvals",
];

export const ROLES: readonly string[] = [
  "Customers",
  "Staff",
  "Managers",
  "Admins",
  "Partners or suppliers",
  "Field teams",
  "Executives",
];

export interface Feature {
  key: FeatureKey;
  title: string;
  body: string;
  requirement: string;
  matcher: RegExp;
}

export const FEATURES: readonly Feature[] = [
  { key: "accounts", title: "Accounts and sign-in", body: "People create an account, sign in and manage their details.", requirement: "People can create an account, sign in securely and manage their own details.", matcher: /login|log in|sign in|account|portal|member/ },
  { key: "dashboard", title: "Dashboards and reporting", body: "The numbers people check every week, in one place.", requirement: "Dashboards show the key numbers, with filters and the option to export.", matcher: /dashboard|report|kpi|metric|sales|numbers|performance|analytics/ },
  { key: "forms", title: "Forms and data capture", body: "Collect information without paper or spreadsheets.", requirement: "People capture information through forms with validation, so data arrives clean.", matcher: /form|capture|survey|application|onboard|log jobs|intake/ },
  { key: "workflow", title: "Workflows and approvals", body: "Work moves between people, with sign-off at the right points.", requirement: "Work moves through defined stages, with approvals and a clear record of who did what.", matcher: /approv|workflow|sign-off|sign off|review|onboard/ },
  { key: "notify", title: "Notifications", body: "Email, text or in-app alerts when something needs attention.", requirement: "People get email or in-app notifications when something needs their attention.", matcher: /notif|alert|remind|email/ },
  { key: "search", title: "Search and filtering", body: "Find any record quickly.", requirement: "People can search and filter records quickly, even as the data grows.", matcher: /search|find|catalog|catalogue|lookup|directory/ },
  { key: "content", title: "Content you can edit", body: "Change pages and copy without a developer.", requirement: "Admins can edit pages and content without a developer.", matcher: /content|page|blog|cms|website|knowledge/ },
  { key: "files", title: "Files and documents", body: "Upload, store and share documents.", requirement: "People can upload, store and share files, with sensible size and type limits.", matcher: /file|document|upload|photo|pdf|contract/ },
  { key: "payments", title: "Payments and billing", body: "Take payments, send invoices, manage subscriptions.", requirement: "The platform takes payments and issues receipts or invoices through a payment provider.", matcher: /pay|invoice|billing|subscription|checkout|order/ },
  { key: "booking", title: "Booking and scheduling", body: "Appointments, slots or resources.", requirement: "People can book time slots or resources, with availability shown in real time.", matcher: /book|schedul|appointment|slot|calendar|rota/ },
  { key: "messaging", title: "Messaging", body: "Conversations between users or with your team.", requirement: "Users can message each other or the team inside the platform.", matcher: /chat|message|messaging|support/ },
  { key: "ai", title: "AI assistant", body: "Answers questions, drafts text or sorts information.", requirement: "An AI assistant answers questions, drafts text or sorts information, with a person able to check its work.", matcher: /\bai\b|assistant|chatbot|automat|smart/ },
  { key: "import", title: "Import and export", body: "Bring data in from spreadsheets and get it back out.", requirement: "Data can be imported from spreadsheets and exported in common formats.", matcher: /import|export|spreadsheet|csv|excel|three systems|pulls/ },
  { key: "mobile", title: "Works well on phones", body: "Designed for people on the move.", requirement: "Everything works well on phones, not just on desktop.", matcher: /mobile|phone|app\b|field|on the go|technician|driver/ },
  { key: "portal", title: "Public site or portal", body: "A front door for customers or partners.", requirement: "A public-facing site or portal gives customers or partners their own front door.", matcher: /portal|customer-facing|public|website|franchisee|partner/ },
];

export const INTEGRATIONS: readonly string[] = [
  "CRM (Salesforce, HubSpot)",
  "Finance or ERP",
  "Email and calendar",
  "Payment provider",
  "Data warehouse",
  "Single sign-on provider",
  "Spreadsheets",
  "Slack or Teams",
  "Existing database",
  "E-commerce platform",
];

export const COMPLIANCE: readonly string[] = ["GDPR", "PIPEDA", "SOC 2", "HIPAA", "PCI DSS", "Accessibility (WCAG 2.2 AA)"];

export interface HandoverOption {
  key: HandoverKey;
  title: string;
}

export const HANDOVER: readonly HandoverOption[] = [
  { key: "docs", title: "Documentation" },
  { key: "train", title: "Training for our team" },
  { key: "repos", title: "Code in our own repositories" },
  { key: "cloud", title: "Hosted in our cloud account" },
  { key: "support", title: "Support period after launch" },
];

export const HANDOVER_REQUIREMENTS: Record<HandoverKey, string> = {
  docs: "Clear documentation: how it's built, how to run it and how to fix common problems.",
  train: "Hands-on training for the people who'll run and extend it.",
  repos: "All code lives in your own repositories from day one.",
  cloud: "It runs in your own cloud account, with access you control.",
  support: "A support period after launch, with agreed response times.",
};

export interface RunOption {
  key: RunKey;
  title: string;
  body: string;
}

export const RUN_OPTIONS: readonly RunOption[] = [
  { key: "summit", title: "Summit runs it for us", body: "We host, monitor and support it." },
  { key: "team", title: "Our team takes it over", body: "Built for handover from day one." },
  { key: "mix", title: "A mix", body: "Your team runs it with Summit on call." },
  { key: "unsure", title: "Not sure yet", body: "We'll work it out together." },
];

export interface Capability {
  title: string;
  requirement: string;
}

export const CAPABILITIES: Record<CapabilityKey, Capability> = {
  contacts: { title: "Contacts and companies", requirement: "Keep one record for every contact and company, with history and notes." },
  pipeline: { title: "Deals and pipeline", requirement: "Track deals through stages, with values, owners and expected close dates." },
  quotes: { title: "Quotes and proposals", requirement: "Create quotes from a product list and send them for approval or signature." },
  emailtrack: { title: "Email and meeting logging", requirement: "Log emails and meetings against the right contact automatically." },
  campaigns: { title: "Marketing emails", requirement: "Send marketing emails to segments and see who opened and clicked." },
  forecast: { title: "Forecasting", requirement: "Forecast revenue by period, owner and stage." },
  reports: { title: "Reports and dashboards", requirement: "Build reports and dashboards on any record, with filters and exports." },
  tasks: { title: "Tasks and reminders", requirement: "Assign tasks with due dates and reminders." },
  projects: { title: "Projects and boards", requirement: "Plan work as projects, boards or lists, with owners and due dates." },
  timeline: { title: "Timelines and dependencies", requirement: "Show work on a timeline, with dependencies between tasks." },
  automations: { title: "Automations", requirement: "Simple rules that move work on or tell people when something changes." },
  forms: { title: "Forms", requirement: "Collect requests or data through forms that create records automatically." },
  tickets: { title: "Tickets", requirement: "Log, assign and track customer issues from email, web and chat." },
  sla: { title: "Service levels", requirement: "Track response and resolution times against agreed targets." },
  kb: { title: "Help centre", requirement: "Publish help articles customers can search." },
  chat: { title: "Live chat", requirement: "Talk to customers in real time from the website or app." },
  inventory: { title: "Stock and inventory", requirement: "Track stock across locations, with reorder alerts." },
  orders: { title: "Orders", requirement: "Take and manage orders from creation to delivery." },
  purchasing: { title: "Purchasing", requirement: "Raise purchase orders and match them to supplier invoices." },
  invoicing: { title: "Invoicing", requirement: "Create and send invoices, and track what's been paid." },
  ledger: { title: "Accounts and ledger", requirement: "Keep the books, with bank reconciliation and sales tax or VAT." },
  expenses: { title: "Expenses", requirement: "Submit and approve expenses with receipts." },
  catalogue: { title: "Product catalogue", requirement: "Manage products, variants, prices and images." },
  checkout: { title: "Checkout and payments", requirement: "Let customers pay online by card and digital wallet." },
  promos: { title: "Discounts and promotions", requirement: "Run discount codes and promotions with clear rules." },
  people: { title: "Employee records", requirement: "Keep employee records, roles and documents in one place." },
  leave: { title: "Holiday and absence", requirement: "Request and approve time off, with balances." },
  onboarding: { title: "Onboarding", requirement: "Run new starter checklists across teams." },
  reviews: { title: "Performance reviews", requirement: "Run review cycles with goals and feedback." },
  scheduling: { title: "Scheduling", requirement: "Book appointments or jobs against real availability." },
  dispatch: { title: "Job dispatch", requirement: "Assign jobs to field staff and track them through to completion." },
  mobilejobs: { title: "Mobile job sheets", requirement: "Field staff see jobs, capture photos and get sign-off on a phone." },
  docs: { title: "Documents and sharing", requirement: "Store, share and version documents, with permissions." },
  lists: { title: "Custom tables", requirement: "Hold your own records in tables people can sort, filter and edit." },
  approvals: { title: "Approvals", requirement: "Route items for approval, with a record of who approved what." },
  portal: { title: "Customer portal", requirement: "Customers sign in to see their own records and requests." },
  issues: { title: "Issues and sprints", requirement: "Track work as issues, planned into sprints with estimates." },
  roadmap: { title: "Roadmaps", requirement: "Share a roadmap of upcoming work." },
  shared: { title: "Working together", requirement: "Several people work on the same data without overwriting each other." },
  formulas: { title: "Calculations", requirement: "Calculations and rules that update automatically as data changes." },
};

export interface SystemCategory {
  category: string;
  roles: readonly string[];
  systems: Record<string, readonly CapabilityKey[]>;
}

export const SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  {
    category: "CRM and sales",
    roles: ["Staff", "Managers"],
    systems: {
      Salesforce: ["contacts", "pipeline", "quotes", "emailtrack", "forecast", "reports", "tasks", "automations", "portal"],
      HubSpot: ["contacts", "pipeline", "emailtrack", "campaigns", "forms", "reports", "tasks", "automations", "tickets"],
      "Microsoft Dynamics 365": ["contacts", "pipeline", "quotes", "forecast", "reports", "tasks", "automations", "approvals"],
      Pipedrive: ["contacts", "pipeline", "emailtrack", "reports", "tasks", "automations"],
      "Zoho CRM": ["contacts", "pipeline", "quotes", "campaigns", "reports", "tasks", "automations"],
    },
  },
  {
    category: "Work management",
    roles: ["Staff", "Managers"],
    systems: {
      "Monday.com": ["projects", "timeline", "automations", "forms", "reports", "approvals", "shared"],
      Asana: ["projects", "timeline", "tasks", "forms", "automations", "reports"],
      Jira: ["issues", "roadmap", "automations", "reports", "approvals"],
      Smartsheet: ["projects", "timeline", "lists", "forms", "automations", "approvals", "reports"],
      Trello: ["projects", "tasks", "automations"],
    },
  },
  {
    category: "Spreadsheets and databases",
    roles: ["Staff"],
    systems: {
      Excel: ["lists", "formulas", "shared", "reports"],
      "Google Sheets": ["lists", "formulas", "shared", "reports", "forms"],
      "Microsoft Access": ["lists", "forms", "reports", "formulas"],
      Airtable: ["lists", "forms", "automations", "reports", "approvals"],
      SharePoint: ["docs", "lists", "approvals", "forms"],
    },
  },
  {
    category: "Finance and ERP",
    roles: ["Staff", "Managers"],
    systems: {
      QuickBooks: ["invoicing", "ledger", "expenses", "reports", "purchasing"],
      Xero: ["invoicing", "ledger", "expenses", "reports", "purchasing"],
      Sage: ["invoicing", "ledger", "purchasing", "reports", "inventory"],
      NetSuite: ["ledger", "invoicing", "purchasing", "inventory", "orders", "reports", "approvals"],
      "SAP Business One": ["ledger", "invoicing", "purchasing", "inventory", "orders", "reports"],
    },
  },
  {
    category: "Customer service",
    roles: ["Customers", "Staff"],
    systems: {
      Zendesk: ["tickets", "sla", "kb", "chat", "reports", "automations", "portal"],
      Freshdesk: ["tickets", "sla", "kb", "chat", "reports", "automations"],
      ServiceNow: ["tickets", "sla", "approvals", "kb", "reports", "automations", "portal"],
      Intercom: ["chat", "tickets", "kb", "campaigns", "automations"],
    },
  },
  {
    category: "E-commerce",
    roles: ["Customers", "Admins"],
    systems: {
      Shopify: ["catalogue", "checkout", "orders", "inventory", "promos", "reports"],
      WooCommerce: ["catalogue", "checkout", "orders", "promos"],
      "Adobe Commerce": ["catalogue", "checkout", "orders", "inventory", "promos", "portal", "reports"],
    },
  },
  {
    category: "HR and people",
    roles: ["Staff", "Managers"],
    systems: {
      BambooHR: ["people", "leave", "onboarding", "reviews", "reports"],
      Workday: ["people", "leave", "onboarding", "reviews", "approvals", "reports"],
    },
  },
  {
    category: "Field service and booking",
    roles: ["Field teams", "Customers"],
    systems: {
      ServiceTitan: ["scheduling", "dispatch", "mobilejobs", "quotes", "invoicing", "reports"],
      Jobber: ["scheduling", "dispatch", "mobilejobs", "quotes", "invoicing"],
      Calendly: ["scheduling", "forms", "automations"],
    },
  },
];

/** Reason to requirement sentence; `SYS` is replaced with the system name by `reasonSentence`. */
export const REPLACEMENT_REASONS: Record<string, string> = {
  "Too expensive": "Costs less to run than our current SYS licences.",
  "Too complicated for what we need": "Simpler than SYS: everyday tasks take fewer clicks, and new users can work it out on day one.",
  "Doesn't fit how we work": "Built around our own process, not a generic one.",
  "Doesn't connect to our other systems": "Connects to our other systems, so nothing is keyed in twice.",
  "Reporting is weak": "Reports show the numbers we actually manage by, without exporting to spreadsheets.",
  "Too slow": "Everyday screens load in under two seconds.",
  "Contract ending": "Live before our SYS contract ends.",
  "We want to own it": "We own the code and the data.",
};

/** The reasons whose requirement is a Should rather than a Must. */
export const SHOULD_REASONS: readonly string[] = ["Too slow", "Too complicated for what we need"];

export const GENERIC_CAPABILITIES: readonly CapabilityKey[] = ["lists", "forms", "reports", "approvals", "automations", "docs"];

export const IDEA_KINDS: readonly IdeaKind[] = [
  "Automate a step",
  "Summarise or draft",
  "Sort and route",
  "Predict",
  "Answer questions",
  "Spot problems",
];

export const IDEA_SIZES: readonly IdeaSize[] = ["Quick win", "Moderate", "Bigger build"];

export const STEPS: readonly string[] = ["Your business", "The goal", "What it does", "Rules and running it", "Make it smarter", "Submit"];

export const PRIORITIES: readonly Priority[] = ["Must", "Should", "Could"];

export const PRIORITY_LABELS: Record<Priority, string> = { Must: "Must have", Should: "Should have", Could: "Could have" };

export const SOURCE_KEYS: readonly SourceKey[] = ["you", "doc", "system", "suggested", "ai"];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  you: "Added by you",
  doc: "From your document",
  system: "From your current system",
  suggested: "Suggested for you",
  ai: "AI idea",
};

export const TIMING_OPTIONS: readonly string[] = ["No fixed date", "Within 3 months", "3 to 6 months", "6 to 12 months", "There's a hard deadline"];

export const BUDGET_OPTIONS: readonly string[] = ["Not set yet", "Under 25k", "25k to 75k", "75k to 200k", "Over 200k"];

export const RESIDENCY_OPTIONS: readonly string[] = ["No preference", "Canada", "the UK", "the EU", "the US"];

/** The first entry is the blank "Choose one". */
export const SCALE_OPTIONS: readonly string[] = ["", "Fewer than 50 people", "50 to 500 people", "500 to 5,000 people", "More than 5,000 people"];

/** The first entry is the blank "Choose one". */
export const UPTIME_OPTIONS: readonly string[] = ["", "Business hours", "Around the clock"];

export const PROBLEM_STARTERS: readonly string[] = [
  "Today, ___ is done by ___, which means ___.",
  "We lose ___ every month because ___.",
];

export const SUCCESS_STARTERS: readonly string[] = [
  "Cut the time spent on ___ by half within six months",
  "Reduce ___ errors by ___% in the first quarter",
  "Free up ___ hours a week for ___",
  "Grow ___ by ___% within a year",
];

export const SIGNOFF_STARTERS: readonly string[] = ["Me", "Our managing director", "Our head of operations"];
