import { PublicInterviewClient } from "@/components/interview/public-interview-client";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicInterviewPage({ params }: Props) {
  const { token } = await params;
  return <PublicInterviewClient token={token} />;
}
