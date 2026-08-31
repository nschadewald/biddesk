import "react";

/**
 * The declarative half of WebMCP: a form that carries `toolname` becomes a tool
 * the browser derives from the page itself, with no registration call. React and
 * TypeScript do not know these attributes yet.
 *
 * BidDesk offers both styles on purpose. The imperative wrapper covers the nine
 * tools that do not map onto one form submission; `ask_clarification` is also a
 * real form, because asking the client a question IS a form, and a page that
 * already has one should not need a second implementation for the agent.
 */
declare module "react" {
  interface FormHTMLAttributes<T> {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: "";
  }

  interface InputHTMLAttributes<T> {
    toolparamdescription?: string;
  }

  interface TextareaHTMLAttributes<T> {
    toolparamdescription?: string;
  }
}

declare global {
  interface SubmitEvent {
    /** True when an agent submitted the form rather than a person. */
    readonly agentInvoked?: boolean;
    /** Sends the result back to the agent without navigating the page. */
    respondWith?(response: Promise<unknown>): void;
  }
}
