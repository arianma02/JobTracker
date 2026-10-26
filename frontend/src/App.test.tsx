import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";

const fetchMock = vi.fn<typeof fetch>();

const jobs = Array.from({ length: 21 }, (_, index) => ({
  id: String(index + 1),
  title: `Developer ${index + 1}`,
  company: "Example AB",
  location: null,
  notes: null,
  preferred_url: null,
  review_status: "interested",
  application_status: "not_applied",
}));

function jobPage(offset: number, total: number) {
  return Response.json({
    items: jobs.slice(offset, Math.min(offset + 20, total)),
    total,
    limit: 20,
    offset,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // Remove the rendered page before restoring the real fetch function.
  cleanup();
  vi.unstubAllGlobals();
});

test("shows loading while the request is pending", () => {
  fetchMock.mockReturnValue(new Promise(() => {}));

  render(<App />);

  expect(screen.getByRole("status").textContent).toBe("Loading your jobs…");
  expect(screen.queryByRole("list")).toBeNull();
});

test("displays returned jobs and their separate statuses", async () => {
  fetchMock.mockResolvedValue(jobPage(0, 1));

  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Developer 1" }),
  ).toBeTruthy();
  expect(screen.getByText("Example AB")).toBeTruthy();
  expect(screen.getByText("Review").nextElementSibling?.textContent).toBe(
    "Interested",
  );
  expect(screen.getByText("Application").nextElementSibling?.textContent).toBe(
    "Not applied",
  );
  expect(screen.queryByRole("status")).toBeNull();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs?limit=20&offset=0");
});

test("shows an empty message and disables both page buttons", async () => {
  fetchMock.mockResolvedValue(jobPage(0, 0));

  render(<App />);

  expect(await screen.findByText("No jobs recorded yet.")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
  ).toBe(true);
});

test("shows an error when the network request fails", async () => {
  fetchMock.mockRejectedValue(new TypeError("Network unavailable"));

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not load your jobs",
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("shows an error for an HTTP failure response", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

  render(<App />);

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not load your jobs",
  );
  expect(screen.queryByRole("status")).toBeNull();
});

test("Next and Previous request the correct pages and respect the ends", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21))
    .mockResolvedValueOnce(jobPage(0, 21));

  render(<App />);

  await screen.findByText("Showing 1–20 of 21 jobs.");
  expect(screen.getAllByRole("listitem")).toHaveLength(20);
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
  ).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Next" }));

  await screen.findByText("Showing 21–21 of 21 jobs.");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Developer 21" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Developer 1" })).toBeNull();
  expect(fetchMock.mock.calls[1][0]).toBe("/api/jobs?limit=20&offset=20");
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
  ).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Previous" }));

  await screen.findByText("Showing 1–20 of 21 jobs.");
  expect(screen.getAllByRole("listitem")).toHaveLength(20);
  expect(fetchMock.mock.calls[2][0]).toBe("/api/jobs?limit=20&offset=0");
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("disabled"),
  ).toBe(false);
});

test("adding a job refreshes the first page even when already on it", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(Response.json({ id: "1" }, { status: 201 }))
    .mockResolvedValueOnce(jobPage(0, 1));
  render(<App />);
  await screen.findByText("No jobs recorded yet.");
  fireEvent.change(screen.getByLabelText("Job title"), {
    target: { value: "Developer 1" },
  });
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "Example AB" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  await screen.findByRole("heading", { name: "Developer 1" });
  expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/jobs?limit=20&offset=0");
});

test("opens a job from page two and returns to the same list page", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21))
    .mockResolvedValueOnce(Response.json(jobs[20]));
  render(<App />);
  await screen.findByText("Showing 1–20 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Showing 21–21 of 21 jobs.");

  fireEvent.click(screen.getByRole("button", { name: "Developer 21" }));

  await screen.findByText("No notes yet.");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/jobs/21");
  expect(screen.queryByRole("navigation", { name: "Job pages" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Back to jobs" }));

  expect(screen.getByText("Showing 21–21 of 21 jobs.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Developer 21" })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("saving a job refreshes statuses on the current list page", async () => {
  const updatedJob = {
    ...jobs[20],
    notes: "Updated notes",
    application_status: "rejected",
  };
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21))
    .mockResolvedValueOnce(Response.json(jobs[20]))
    .mockResolvedValueOnce(Response.json(updatedJob))
    .mockResolvedValueOnce(
      Response.json({ items: [updatedJob], total: 21, limit: 20, offset: 20 }),
    );
  render(<App />);
  await screen.findByText("Showing 1–20 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Showing 21–21 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Developer 21" }));
  await screen.findByText("No notes yet.");
  fireEvent.click(
    screen.getByRole("button", { name: "Edit notes and statuses" }),
  );
  fireEvent.change(screen.getByLabelText("Application status"), {
    target: { value: "rejected" },
  });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Updated notes" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await screen.findByText("Changes saved.");
  expect(screen.getByText("Updated notes")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to jobs" }));
  await within(screen.getByRole("list")).findByText("Rejected");
  expect(screen.getByText("Showing 21–21 of 21 jobs.")).toBeTruthy();
  expect(fetchMock.mock.calls[3][1]?.method).toBe("PATCH");
  expect(fetchMock.mock.calls[4][0]).toBe("/api/jobs?limit=20&offset=20");
});

test("waits for Apply filters, trims search text, and encodes special characters", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 1))
    .mockResolvedValueOnce(jobPage(0, 0));
  render(<App />);
  await screen.findByText("Showing 1–1 of 1 jobs.");

  fireEvent.change(screen.getByLabelText("Search recorded jobs"), {
    target: { value: "  C++ & Python  " },
  });
  expect(fetchMock).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await screen.findByText("No jobs match these filters.");
  expect(fetchMock.mock.calls[1][0]).toBe(
    "/api/jobs?limit=20&offset=0&q=C%2B%2B+%26+Python",
  );
  expect(screen.queryByText("No jobs recorded yet.")).toBeNull();
});

test("combines filters, starts at offset zero, and retains filters during pagination", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21))
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21));
  render(<App />);
  await screen.findByText("Showing 1–20 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Showing 21–21 of 21 jobs.");
  fireEvent.change(screen.getByLabelText("Search recorded jobs"), {
    target: { value: "Developer" },
  });
  fireEvent.change(screen.getByLabelText("Review status filter"), {
    target: { value: "interested" },
  });
  fireEvent.change(screen.getByLabelText("Application status filter"), {
    target: { value: "not_applied" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await screen.findByText("Showing 1–20 of 21 jobs.");
  expect(fetchMock.mock.calls[2][0]).toBe(
    "/api/jobs?limit=20&offset=0&q=Developer&review_status=interested&application_status=not_applied",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Showing 21–21 of 21 jobs.");
  expect(fetchMock.mock.calls[3][0]).toBe(
    "/api/jobs?limit=20&offset=20&q=Developer&review_status=interested&application_status=not_applied",
  );
});

test("Clear filters resets controls and requests the unfiltered list", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 1))
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(jobPage(0, 1));
  render(<App />);
  await screen.findByText("Showing 1–1 of 1 jobs.");
  fireEvent.change(screen.getByLabelText("Search recorded jobs"), {
    target: { value: "No matching job" },
  });
  fireEvent.change(screen.getByLabelText("Review status filter"), {
    target: { value: "not_interested" },
  });
  fireEvent.change(screen.getByLabelText("Application status filter"), {
    target: { value: "rejected" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByText("No jobs match these filters.");

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

  await screen.findByText("Showing 1–1 of 1 jobs.");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/jobs?limit=20&offset=0");
  expect(
    (screen.getByLabelText("Search recorded jobs") as HTMLInputElement).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Review status filter") as HTMLSelectElement).value,
  ).toBe("");
  expect(
    (screen.getByLabelText("Application status filter") as HTMLSelectElement)
      .value,
  ).toBe("");
});

test("creating a job clears filters so the new job is visible", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(Response.json({ id: "1" }, { status: 201 }))
    .mockResolvedValueOnce(jobPage(0, 1));
  render(<App />);
  await screen.findByText("No jobs recorded yet.");
  fireEvent.change(screen.getByLabelText("Search recorded jobs"), {
    target: { value: "Something else" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByText("No jobs match these filters.");
  fireEvent.change(screen.getByLabelText("Job title"), {
    target: { value: "Developer 1" },
  });
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "Example AB" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  await screen.findByRole("heading", { name: "Developer 1" });
  expect(fetchMock.mock.calls[3][0]).toBe("/api/jobs?limit=20&offset=0");
  expect(
    (screen.getByLabelText("Search recorded jobs") as HTMLInputElement).value,
  ).toBe("");
});

test("Applications requests the application subset and My Jobs restores all jobs", async () => {
  const appliedJob = { ...jobs[0], application_status: "applied" };
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 1))
    .mockResolvedValueOnce(
      Response.json({ items: [appliedJob], total: 1, limit: 20, offset: 0 }),
    )
    .mockResolvedValueOnce(jobPage(0, 1));
  render(<App />);
  await screen.findByText("Showing 1–1 of 1 jobs.");

  fireEvent.click(screen.getByRole("button", { name: "Applications" }));

  await screen.findByText("Showing 1–1 of 1 applications.");
  expect(fetchMock.mock.calls[1][0]).toBe(
    "/api/jobs?limit=20&offset=0&applications_only=true",
  );
  expect(screen.queryByLabelText("Job title")).toBeNull();
  expect(
    within(screen.getByLabelText("Application status filter")).queryByRole(
      "option",
      { name: "Not applied" },
    ),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Applications" })
      .getAttribute("aria-current"),
  ).toBe("page");

  fireEvent.click(screen.getByRole("button", { name: "My Jobs" }));

  await screen.findByText("Showing 1–1 of 1 jobs.");
  expect(fetchMock.mock.calls[2][0]).toBe("/api/jobs?limit=20&offset=0");
  expect(screen.getByLabelText("Job title")).toBeTruthy();
});

test("applying and clearing filters keeps the Applications scope", async () => {
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(jobPage(0, 0));
  render(<App />);
  await screen.findByText("No jobs recorded yet.");
  fireEvent.click(screen.getByRole("button", { name: "Applications" }));
  await screen.findByText("No applications recorded yet.");
  fireEvent.change(screen.getByLabelText("Application status filter"), {
    target: { value: "rejected" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await screen.findByText("No applications match these filters.");
  expect(fetchMock.mock.calls[2][0]).toBe(
    "/api/jobs?limit=20&offset=0&application_status=rejected&applications_only=true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByText("No applications recorded yet.");
  expect(fetchMock.mock.calls[3][0]).toBe(
    "/api/jobs?limit=20&offset=0&applications_only=true",
  );
});

test("switching views resets pagination and saving Not applied removes only the application", async () => {
  const appliedJob = { ...jobs[0], application_status: "applied" };
  const updatedJob = { ...appliedJob, application_status: "not_applied" };
  fetchMock
    .mockResolvedValueOnce(jobPage(0, 21))
    .mockResolvedValueOnce(jobPage(20, 21))
    .mockResolvedValueOnce(
      Response.json({ items: [appliedJob], total: 1, limit: 20, offset: 0 }),
    )
    .mockResolvedValueOnce(Response.json(appliedJob))
    .mockResolvedValueOnce(Response.json(updatedJob))
    .mockResolvedValueOnce(jobPage(0, 0))
    .mockResolvedValueOnce(
      Response.json({ items: [updatedJob], total: 1, limit: 20, offset: 0 }),
    );
  render(<App />);
  await screen.findByText("Showing 1–20 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Showing 21–21 of 21 jobs.");
  fireEvent.click(screen.getByRole("button", { name: "Applications" }));
  await screen.findByText("Showing 1–1 of 1 applications.");
  expect(fetchMock.mock.calls[2][0]).toBe(
    "/api/jobs?limit=20&offset=0&applications_only=true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Developer 1" }));
  await screen.findByText("No notes yet.");
  fireEvent.click(
    screen.getByRole("button", { name: "Edit notes and statuses" }),
  );
  fireEvent.change(screen.getByLabelText("Application status"), {
    target: { value: "not_applied" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Changes saved.");

  fireEvent.click(screen.getByRole("button", { name: "Back to jobs" }));

  await screen.findByText("No applications recorded yet.");
  expect(fetchMock.mock.calls[5][0]).toBe(
    "/api/jobs?limit=20&offset=0&applications_only=true",
  );
  fireEvent.click(screen.getByRole("button", { name: "My Jobs" }));
  await screen.findByRole("button", { name: "Developer 1" });
  expect(
    within(screen.getByRole("list")).getByText("Not applied"),
  ).toBeTruthy();
});
