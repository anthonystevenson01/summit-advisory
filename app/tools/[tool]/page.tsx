import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ToolRunner from "./ToolRunner";
import { TOOL_SEO, TOOL_SLUGS, isToolSlug } from "./toolSlugs";

type Params = Promise<{ tool: string }>;

export function generateStaticParams() {
  return TOOL_SLUGS.map((tool) => ({ tool }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tool } = await params;
  if (!isToolSlug(tool)) return {};
  const seo = TOOL_SEO[tool];
  return {
    title: seo.title,
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "website",
    },
  };
}

export default async function ToolPage({ params }: { params: Params }) {
  const { tool } = await params;
  if (!isToolSlug(tool)) notFound();
  return <ToolRunner slug={tool} />;
}
