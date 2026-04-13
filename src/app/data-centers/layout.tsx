import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data centers by name",
  description: "Alphabetical list of data centers with links to facility detail pages.",
};

export default function DataCentersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
