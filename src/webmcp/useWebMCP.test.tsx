import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { declareFormTool, formToolStatus } from "./registry";
import type { WebMCPTool } from "./types";
import { useWebMCP } from "./useWebMCP";

/**
 * Who decides whether the form is a tool: the browser, by listing it.
 *
 * The bug this pins: ChatGPT's browser has the SubmitEvent extension underneath
 * (Chromium), so a feature test said "declarative works" -- and the page
 * declared the form, counted it, and registered no imperative twin. ChatGPT's
 * agent layer does not list form tools. The panel said ten, the agent saw
 * nine, and the tester's fourth prompt ended as text typed into the form field
 * and never sent. A feature test proves the DOM API exists. Only the browser's
 * own list proves an agent can see the tool.
 */

/**
 * A browser with three personalities. It records registrations, withdraws them
 * on abort like the real one, and answers getTools() the way Chrome 152 does:
 * with a Promise, listing what was registered -- plus the form, once told to
 * show it, with a toolchange to say so.
 */
function stubBrowser(personality: "lists-form" | "lists-no-form" | "cannot-list") {
  const registered = new Set<string>();
  const listeners: (() => void)[] = [];
  let formVisible = false;

  const context: Record<string, unknown> = {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }) {
      registered.add(tool.name);
      options?.signal?.addEventListener("abort", () => registered.delete(tool.name));
      return Promise.resolve();
    },
    addEventListener(type: string, listener: () => void) {
      if (type === "toolchange") listeners.push(listener);
    }
  };
  if (personality !== "cannot-list") {
    context.getTools = () =>
      Promise.resolve(
        [...registered, ...(formVisible ? ["ask_clarification"] : [])].map((name) => ({ name }))
      );
  }
  Object.defineProperty(document, "modelContext", { configurable: true, value: context });

  return {
    registered,
    /** Chrome 152: the form's tool shows up ~30 ms after the form, with a toolchange. */
    showForm() {
      if (personality !== "lists-form") throw new Error("this browser never lists the form");
      formVisible = true;
      for (const listener of listeners) listener();
    }
  };
}

const tick = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

let undeclare: (() => void) | null = null;

/** What Clarifications does once the tender is on screen. */
async function declareTheForm() {
  await act(async () => {
    undeclare = declareFormTool({ name: "ask_clarification", title: "Ask", readOnly: false });
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no declarative form API; stand one in, as ChatGPT's Chromium has.
  Object.defineProperty(SubmitEvent.prototype, "respondWith", {
    configurable: true,
    value: () => undefined
  });
});

afterEach(() => {
  undeclare?.();
  undeclare = null;
  Reflect.deleteProperty(SubmitEvent.prototype, "respondWith");
  Reflect.deleteProperty(document, "modelContext");
  vi.useRealTimers();
});

it("leaves the form as the tool where the browser lists it, and registers no twin", async () => {
  const browser = stubBrowser("lists-form");
  const hook = renderHook(() => useWebMCP("bidder", true));
  await tick();
  await declareTheForm();

  // While the browser is still deciding, nothing is registered under that
  // name: a twin landing now would collide with the form (Chrome refuses the
  // duplicate outright).
  expect(formToolStatus("ask_clarification")).toBe("pending");
  await tick(30);
  expect(browser.registered.has("ask_clarification")).toBe(false);

  await act(async () => {
    browser.showForm();
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(formToolStatus("ask_clarification")).toBe("confirmed");

  // And it stays that way past every deadline.
  await tick(2000);
  expect(browser.registered.has("ask_clarification")).toBe(false);

  const tools = hook.result.current.tools;
  expect(tools.filter((tool) => tool.confirmed)).toHaveLength(11);
  expect(tools.find((tool) => tool.name === "ask_clarification")).toMatchObject({
    kind: "declarative",
    confirmed: true
  });
  hook.unmount();
});

it("registers the twin where the browser lists tools but never the form", async () => {
  // ChatGPT's browser, as far as the page can tell: SubmitEvent says yes,
  // getTools() says the nine we registered and nothing else.
  const browser = stubBrowser("lists-no-form");
  const hook = renderHook(() => useWebMCP("bidder", true));
  await tick();
  await declareTheForm();

  await tick(100);
  expect(formToolStatus("ask_clarification")).toBe("pending");
  expect(browser.registered.has("ask_clarification")).toBe(false);

  // The last check comes and goes without the form. Silence is a no.
  await tick(700);
  expect(formToolStatus("ask_clarification")).toBe("unconfirmed");
  expect(browser.registered.has("ask_clarification")).toBe(true);

  const tools = hook.result.current.tools;
  // Eleven confirmed: ten plus the twin, which the browser now lists.
  expect(tools.filter((tool) => tool.confirmed)).toHaveLength(11);
  expect(tools.filter((tool) => tool.name === "ask_clarification")).toEqual([
    expect.objectContaining({ kind: "imperative", confirmed: true }),
    // The form is still on the page and still shown -- as what it is: declared
    // by us, not vouched for by this browser, and not in the number.
    expect.objectContaining({ kind: "declarative", confirmed: false })
  ]);
  hook.unmount();
});

it("registers the twin at once where the browser cannot list its tools at all", async () => {
  const browser = stubBrowser("cannot-list");
  const hook = renderHook(() => useWebMCP("bidder", true));
  await tick();
  await declareTheForm();

  // No list means no confirmation, and nothing to wait for.
  expect(formToolStatus("ask_clarification")).toBe("unconfirmed");
  expect(browser.registered.has("ask_clarification")).toBe(true);

  const tools = hook.result.current.tools;
  // What we registered counts -- the calls resolved -- and the form does not.
  expect(tools.filter((tool) => tool.confirmed).map((tool) => tool.name)).toContain(
    "ask_clarification"
  );
  expect(tools.filter((tool) => tool.confirmed)).toHaveLength(11);
  expect(tools.find((tool) => tool.kind === "declarative")).toMatchObject({ confirmed: false });
  hook.unmount();
});

it("withdraws the twin with the role, and decides afresh when the form returns", async () => {
  const browser = stubBrowser("lists-no-form");
  const hook = renderHook(({ role }) => useWebMCP(role, true), {
    initialProps: { role: "bidder" as "bidder" | "client" }
  });
  await tick();
  await declareTheForm();
  await tick(700);
  expect(browser.registered.has("ask_clarification")).toBe(true);

  // Leaving the bidder role takes the form off the page and the twin with it.
  await act(async () => {
    undeclare?.();
    undeclare = null;
    hook.rerender({ role: "client" });
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(browser.registered.has("ask_clarification")).toBe(false);
  expect(formToolStatus("ask_clarification")).toBe("absent");
  hook.unmount();
});
