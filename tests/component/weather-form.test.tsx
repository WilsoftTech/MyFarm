import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeatherForm } from "@/components/weather/weather-form";
const id = "a0000000-0000-4000-8000-000000000001";
const input = { scenario: "RAIN", activityId: id, cycleId: null, stage: null };
const expiry = new Date(Date.now()+600_000).toISOString();
const report = { testOnly: true, checkedAt: "2026-11-20T12:00:00Z", district: "Rukungiri", crop: null, stage: null, recurring: false, taskContext: {enterprise:"Maize",plot:"Plot B"},
  forecast: { provider: "synthetic", issuedAt: "2026-11-20T12:00:00Z", expiresAt: expiry, validFrom: "2026-11-20T12:00:00Z", validTo: "2026-11-22T12:00:00Z" },
  activity: { status: "TEST_NOTICE", message: "Test rain may affect Spraying.", limitations: ["CROP_MISSING"], activity: { activityId: id, dueOn: "2026-11-21", version: 1, label: "Spraying" } },
  notices: ["FORECAST", "RAIN", "PLANTING", "SPRAYING", "IRRIGATION", "EXTREME"].map(key => ({ key, status: "TEST_SIGNAL", message: key+": synthetic signal for testing only." })) };
const review = { report, confirmation: { input, newDueOn: "2026-11-22", oldDueOn: "2026-11-21", expectedVersion: 1, reviewHash: "a".repeat(64), expiresAt: expiry } };
afterEach(() => vi.unstubAllGlobals());
describe("weather review interface", () => {
  it("refuses malformed display data with a plain recoverable error",async()=>{
    const user=userEvent.setup();vi.stubGlobal("fetch",vi.fn(async()=>Response.json({testOnly:false})));
    render(<WeatherForm farmId={id} activities={[]} crops={[]} />);
    await user.click(screen.getByRole("button",{name:"Check test forecast"}));
    await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("The response could not be checked"));
    expect(screen.queryByRole("heading",{name:"Test forecast results"})).not.toBeInTheDocument();
  });
  it("keeps consent separate, clears it after edits and retries an uncertain write with the identical payload", async () => {
    const user = userEvent.setup(); const bodies: string[] = []; let attempt=0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
      if(url.endsWith("/check")) return Response.json(report);
      if(url.endsWith("/review")) return Response.json(review);
      bodies.push(String(options.body)); if(attempt++===0) throw new Error("Lost response");
      return Response.json({ activityId:id, oldDueOn:"2026-11-21",newDueOn:"2026-11-22",version:2,receiptId:id });
    }));
    render(<WeatherForm farmId={id} initialActivityId={id} activities={[{id,label:"Spraying"}]} crops={[]} />);
    await user.click(screen.getByRole("button",{name:"Check test forecast"}));
    await screen.findByRole("heading",{name:"Test forecast results"});
    await user.type(screen.getByLabelText("New activity date"),"2026-11-22");
    await user.click(screen.getByRole("button",{name:"Review date change"}));
    await screen.findByRole("heading",{name:"Check this date change"});
    expect(screen.getByText("For: Maize, Plot B.")).toBeVisible();
    expect(screen.getByRole("button",{name:"Confirm date change"})).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button",{name:"Confirm date change"}));
    await screen.findByRole("button",{name:"Retry this confirmation"});
    expect(screen.getByLabelText("New activity date")).toBeDisabled();
    await user.click(screen.getByRole("button",{name:"Retry this confirmation"}));
    await screen.findByRole("heading",{name:"Date change saved"}); expect(bodies[0]).toBe(bodies[1]);
  });
  it("shows offline failure without queuing or sending a request", async () => {
    const user=userEvent.setup(); const fetch=vi.fn(); vi.stubGlobal("fetch",fetch);
    vi.spyOn(navigator,"onLine","get").mockReturnValue(false);
    render(<WeatherForm farmId={id} activities={[]} crops={[]} />);
    await user.click(screen.getByRole("button",{name:"Check test forecast"}));
    await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("offline"));expect(fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
