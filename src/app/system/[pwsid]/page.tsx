async function getEPAData(pwsid: string) {
  const res = await fetch(
    `https://data.epa.gov/efservice/SDW_VIOL_ENFORCEMENT/PWSID/${pwsid}/JSON`,
    { cache: "no-store" }
  );

  return res.json();
}

export default async function SystemPage({
  params,
}: {
  params: Promise<{ pwsid: string }>;
}) {
  const { pwsid } = await params;
  const data = await getEPAData(pwsid);

  return (
    <main className="p-6">
      <h1>PWSID: {pwsid}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
