const steps = [
  { title: "Sign Up", desc: "Create your free account in 30 seconds" },
  { title: "Set Your Level", desc: "Tell us your English level and interests" },
  { title: "Get Matched", desc: "We find the perfect partner for you" },
  { title: "Start Speaking", desc: "Video call and practice together" },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-16" id="features">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-2xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-4">
          {steps.map((step, i) => (
            <div key={i} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {i + 1}
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
