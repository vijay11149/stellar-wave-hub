import { getSupabase } from "@/lib/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString();

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .in("status", ["approved", "featured"]);

    if (projectsError) throw projectsError;

    const projectRows = (projects || []).map((row) => ({
      ...row,
      id: row.numericId,
    }));

    // Load ratings created in the last 7 days
    const { data: recentRatings, error: ratingsError } = await supabase
      .from("ratings")
      .select("project_id, score, created_at")
      .gte("created_at", sevenDaysAgo);

    if (ratingsError) throw ratingsError;

    const recentCountsByProject = new Map<number, number>();
    const scoresByProject = new Map<number, number[]>();

    for (const r of recentRatings || []) {
      const pid = r.project_id as number;
      if (!pid) continue;
      const score = Number(r.score) || 0;
      recentCountsByProject.set(pid, (recentCountsByProject.get(pid) || 0) + 1);
      if (!scoresByProject.has(pid)) scoresByProject.set(pid, []);
      scoresByProject.get(pid)!.push(score);
    }

    const userCache = new Map<number, string>();
    const enriched = await Promise.all(
      projectRows.map(async (p) => {
        const uid = p.user_id as number;
        if (uid && !userCache.has(uid)) {
          const { data: u } = await supabase
            .from("users")
            .select("username")
            .eq("numericId", uid)
            .maybeSingle();
          userCache.set(uid, u?.username ?? "unknown");
        }
        const scores = scoresByProject.get(p.id as number) || [];
        const recentCount = recentCountsByProject.get(p.id as number) || 0;
        const avg_rating =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null;
        return {
          ...p,
          username: uid ? userCache.get(uid) : null,
          avg_rating,
          rating_count: scores.length,
          rating_count_last_7_days: recentCount,
        };
      }),
    );

    // Primary sort: number of ratings in the last 7 days (desc)
    // Tie-break: average score (desc)
    enriched.sort((a, b) => {
      const countA = (a.rating_count_last_7_days as number) || 0;
      const countB = (b.rating_count_last_7_days as number) || 0;
      if (countB !== countA) return countB - countA;
      const rateA = (a.avg_rating as number) || 0;
      const rateB = (b.avg_rating as number) || 0;
      if (rateB !== rateA) return rateB - rateA;
      return (b.created_at as string) > (a.created_at as string) ? 1 : -1;
    });

    // If there is recent rating activity, return the top 6 trending projects
    const topTrending = enriched.filter(
      (p) => (p.rating_count_last_7_days as number) || 0 > 0,
    );

    if (topTrending.length > 0) {
      return Response.json({
        projects: topTrending.slice(0, 6),
        sort: "trending",
        period_days: 7,
      });
    }

    // Fallback: no recent activity → return top-rated projects (by avg_rating, then rating_count)
    enriched.sort((a, b) => {
      const rateA = (a.avg_rating as number) || 0;
      const rateB = (b.avg_rating as number) || 0;
      if (rateB !== rateA) return rateB - rateA;
      const countA = (a.rating_count as number) || 0;
      const countB = (b.rating_count as number) || 0;
      if (countB !== countA) return countB - countA;
      return (b.created_at as string) > (a.created_at as string) ? 1 : -1;
    });

    return Response.json({
      projects: enriched.slice(0, 6),
      sort: "top-rated",
      fallback: true,
      period_days: 7,
    });
  } catch (err) {
    console.error("Trending projects error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
