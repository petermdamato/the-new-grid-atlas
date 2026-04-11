import Link from "next/link";
import { ArrowLeft, Coffee } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="min-h-screen w-screen bg-gray-50 font-jakarta flex items-center justify-center p-6 relative overflow-y-auto">
      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors duration-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-semibold">Back to Map</span>
      </Link>

      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-10 md:p-12 my-16">
        <div className="mb-10">
          <span className="block text-[10px] font-semibold tracking-[0.1em] text-zinc-400 uppercase mb-2">
            About this project
          </span>
          <h2 className="font-bold text-zinc-900 leading-tight mb-5">
            Utility System Explorer
          </h2>
          <div className="space-y-4 text-base text-zinc-600 leading-relaxed">
            <p>
              We&apos;re living through a boom in artificial intelligence, where investor dollars have been funneled
              to train models on massive troves of data. Reports have found these data centers, known as hyperscalers, to have issues ranging from exploding electric bills and concerns about water supply, as the
              centers require not only data but energy and water for cooling. There are even reports
              these centers heat the ambient air, raising local temperatures as much as 16 degrees Fahrenheit.
            </p>
            <p>
              This tool highlights confirmed locations of data centers. Logged in users can view additional types
              of data centers such as colocation centers (transfer stations for data) and enterprise facilities, being used for a variety of purposes.
            </p>
            <p>
              In the near future, new data points will be added. We plan to include e-commerce distribution centers as well as datasets pulled from satellite imagery, to help residents
              understand the real-world impact the new economy is having on their lives. This project is self funded and is not done for profit. If you can, please donate to support this project.
            </p>
            <p>
              This project is not for profit and will never sell data on data centers, fulfillment, public
              feedback, or other data displayed or collected from users, or distribute it for another commercial use.
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-8 mb-8">
          <h2 className="text-[10px] font-semibold tracking-[0.1em] text-zinc-400 uppercase mb-2">Sources</h2>
          <ul className="flex flex-col gap-1 text-xs text-zinc-600 leading-snug">
            <li>
              <a
                href="https://www.pewresearch.org/short-reads/2025/10/24/what-we-know-about-energy-use-at-us-data-centers-amid-the-ai-boom/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
              >
                Energy usage of data centers
              </a>
            </li>
            <li>
              <a
                href="https://www.law.georgetown.edu/environmental-law-review/blog/consumers-end-up-paying-for-the-energy-demands-of-data-centers-how-can-regulators-fight-back/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
              >
                Effect of data centers on electricity bills
              </a>
            </li>
            <li>
              <a
                href="https://arxiv.org/abs/2603.20897"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
              >
                Heat islands caused by data centers
              </a>
            </li>
            <li>
              <a
                href="https://www.sciencedirect.com/science/article/pii/S2666389925002788"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
              >
                Water footprints of data centers
              </a>
            </li>
          </ul>
        </div>

        <div className="border-t border-zinc-100 pt-8 mb-8">
          <h2 className="text-[10px] font-semibold tracking-[0.1em] text-zinc-400 uppercase mb-2">
            About the Creator
          </h2>
          <p className="text-base text-zinc-600 leading-relaxed">
            Peter D&apos;Amato is a journalist, coder, mapping specialist and data visualization developer. Find
            more of his work on{" "}
            <a
              href="https://www.petedamato.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
            >
              his website
            </a>
            .
          </p>
        </div>

        <div className="border-t border-zinc-100 pt-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="font-bold text-zinc-900 mb-1">Support this work</h3>
            <p className="text-sm text-zinc-500">Help me expand our data coverage and keep the servers running.</p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.buymeacoffee.com/petedamato"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#FF813F] hover:bg-[#ff955c] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Coffee className="w-8 h-8" />
              Support me on BuyMeACoffee
            </a>

            <button
              disabled
              className="flex items-center gap-2 bg-zinc-100 text-zinc-400 text-sm font-bold px-5 py-2.5 rounded-xl cursor-not-allowed border border-zinc-200"
              title="Coming Soon"
            >
              Patreon (Soon)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
