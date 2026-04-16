import NewsletterReader from "@/app/components/newsletter/NewsletterReader";

interface Props {
  params: Promise<{ issue: string }>;
}

export default async function IssuePage({ params }: Props) {
  const { issue } = await params;
  return <NewsletterReader issueId={issue} />;
}
