import { PublicInterviewClient } from "@/components/interview/public-interview-client";
import { ConversationalInterviewClient } from "@/components/interview/conversational-interview-client";
import { getInterviewMode } from "@/lib/actions/conversational-interview";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PublicInterviewPage({ params }: Props) {
  const { token } = await params;
  const mode = await getInterviewMode(token);
  if (mode.conversational) {
    return <ConversationalInterviewClient token={token} />;
  }
  return <PublicInterviewClient token={token} />;
}
