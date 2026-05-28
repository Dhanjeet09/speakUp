const features = [
  { title: "Smart Matching", desc: "Matched by level and interests for the best conversation experience" },
  { title: "Daily Topics", desc: "Never run out of things to talk about" },
  { title: "Progress Tracking", desc: "Watch your fluency improve over time" },
  { title: "Safe Community", desc: "Report and block features keep everyone safe" },
];

export default function Features() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-2xl font-bold">Why SpeakUp?</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="rounded-card border border-gray-200 bg-white p-6"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
