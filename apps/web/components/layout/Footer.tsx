import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()} SpeakUp. All rights reserved.
        </p>
        <div className="flex gap-6">
          <Link
            href="/about"
            className="text-sm text-gray-500 hover:text-primary"
          >
            About
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-gray-500 hover:text-primary"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-gray-500 hover:text-primary"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
