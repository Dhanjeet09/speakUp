import { Badge } from "@/components/ui/badge";

const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function Levels() {
  return (
    <section className="bg-white py-16" id="about">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="text-2xl font-bold">All levels welcome</h2>
        <p className="mt-2 text-gray-600">
          Whether you are just starting or almost fluent, we have a partner for you.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {levels.map((level) => (
            <Badge key={level} variant="outline" className="px-4 py-2 text-sm">
              {level}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
