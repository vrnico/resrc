import { ResourceDetail } from "./ResourceDetail";

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
      <ResourceDetail id={id} />
    </main>
  );
}
