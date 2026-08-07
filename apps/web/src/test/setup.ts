import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
  createElement,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

type TestLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: TestLinkProps) =>
    createElement("a", { ...props, href }, children),
}));

afterEach(() => {
  cleanup();
});
