import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";

const fetchMock = vi.fn<typeof fetch>();

const jobs = Array.from({ length: 21 }, (_, index) => ({
  id: String(index + 1),
  title: `Developer ${index + 1}`,
  company: "Example AB",
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
