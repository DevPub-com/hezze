import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { runPeriodicCheckForArchive } from "@/domains/archive/api/analyze.action";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentDateObject = new Date();
    const currentDateString = currentDateObject.toISOString().split("T")[0];
    const currentDayOfWeek = currentDateObject.getDay();
    const currentDayOfMonth = currentDateObject.getDate();

    const { data: archives, error: fetchError } = await getSupabaseClient()
      .from("archives")
      .select("id, check_interval, created_at, target_dates")
      .gte("expiry_date", currentDateString);

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (archives) {
      for (const archive of archives) {
        try {
          const targetDates: string[] = archive.target_dates || [];
          if (targetDates.includes(currentDateString)) {
            await runPeriodicCheckForArchive(archive.id);
            continue;
          }

          const checkInterval = archive.check_interval;
          if (checkInterval === "DAILY") {
            await runPeriodicCheckForArchive(archive.id);
          } else if (checkInterval === "WEEKLY") {
            const creationDateObject = new Date(archive.created_at);
            if (currentDayOfWeek === creationDateObject.getDay()) {
              await runPeriodicCheckForArchive(archive.id);
            }
          } else if (checkInterval === "MONTHLY") {
            const creationDateObject = new Date(archive.created_at);
            if (currentDayOfMonth === creationDateObject.getDate()) {
              await runPeriodicCheckForArchive(archive.id);
            }
          }
        } catch (individualError: unknown) {
          console.error(`아카이브 ID ${archive.id} 주기적 검사 실행 실패:`, individualError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

