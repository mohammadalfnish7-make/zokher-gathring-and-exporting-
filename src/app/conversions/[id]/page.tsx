import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Single conversions open in the tabbed workspace for a consistent UI. */
export default async function ConversionPage({ params }: Props) {
  const { id } = await params;
  redirect(`/workspace?ids=${id}`);
}
