// TODO: V2 Phase N에서 구현
export default async function CatchAllPage({ params }: { params: Promise<{ slugs: string[] }> }) {
  const { slugs } = await params;
  return (
    <div>
      <h1>페이지 준비 중</h1>
      <p>경로: {slugs.join('/')}</p>
    </div>
  );
}
