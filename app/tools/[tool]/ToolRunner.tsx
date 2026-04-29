"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrompts } from "@/app/components/toolkit/hooks/usePrompts";
import { useRubrics } from "@/app/components/toolkit/hooks/useRubrics";
import SiteNav from "@/app/components/SiteNav";
import ToolkitFooter from "@/app/components/toolkit/ToolkitFooter";
import ICPEvaluator from "@/app/components/icp-evaluator";
import PersonaTool from "@/app/components/toolkit/tools/PersonaTool";
import ProblemTool from "@/app/components/toolkit/tools/ProblemTool";
import PositioningTool from "@/app/components/toolkit/tools/PositioningTool";
import MoatTool from "@/app/components/toolkit/tools/MoatTool";
import AccountIntelTool from "@/app/components/toolkit/tools/AccountIntelTool";
import type { ToolSlug } from "./toolSlugs";

const BOOK_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ35rKsxptXY-OfUDUjC4G9jWqVTFtPcCPApotrNSNzoQoEvN-HAegmAab4E5jxQ7NAgSF89ollu?gv=true";

/**
 * Renders a single GTM tool inside the standard toolkit chrome
 * (site nav + back row + footer). Back link is a real anchor so the
 * browser back button / right-click-open-in-new-tab work natively.
 *
 * Accepts optional children rendered between the tool and the footer
 * (e.g. the server-side FAQ section from the parent page).
 */
export default function ToolRunner({ slug, children }: { slug: ToolSlug; children?: React.ReactNode }) {
  const router = useRouter();
  const { prompts } = usePrompts();
  const { rubrics } = useRubrics();

  const goToHub = () => router.push("/tools");

  return (
    <>
      <SiteNav activePage="tools" />
      <div className="page">
        {/* Back row — mirrors the inner-back pattern from the rest of the site */}
        <div
          style={{
            background: "var(--forest)",
            padding: "14px 48px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link href="/tools" className="inner-back" style={{ marginBottom: 0 }}>
            ← All GTM Tools
          </Link>
        </div>

        {slug === "icp" && (
          <ICPEvaluator
            onBack={goToHub}
            onBookCall={() => window.open(BOOK_URL, "_blank")}
          />
        )}
        {slug === "persona" && (
          <PersonaTool systemPrompt={prompts.persona} rubric={rubrics.persona} />
        )}
        {slug === "problem" && (
          <ProblemTool systemPrompt={prompts.problem} rubric={rubrics.problem} />
        )}
        {slug === "positioning" && (
          <PositioningTool
            systemPrompt={prompts.positioning}
            rubric={rubrics.positioning}
          />
        )}
        {slug === "moat" && (
          <MoatTool systemPrompt={prompts.moat} rubric={rubrics.moat} />
        )}
        {slug === "account" && <AccountIntelTool systemPrompt={prompts.account} />}

        {children}
        <ToolkitFooter />
      </div>
    </>
  );
}
