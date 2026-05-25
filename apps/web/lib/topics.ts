const topics = [
  "Describe your hometown and what you love about it.",
  "What superpower would you choose and why?",
  "Talk about a meal you will never forget.",
  "What job would you do for free?",
  "If you could visit any country, where would you go?",
  "Describe your favorite movie and why it resonates with you.",
  "What is the best advice you have ever received?",
  "Talk about a hobby you enjoy and how you started it.",
  "If you could meet any historical figure, who would it be?",
  "Describe a challenge you overcame and what you learned.",
  "What does your ideal weekend look like?",
  "Talk about a book that changed your perspective.",
  "If you could learn any skill instantly, what would it be?",
  "Describe a cultural tradition from your country.",
  "What is the funniest thing that has ever happened to you?",
  "If you could live in any era, when would it be?",
  "Talk about a person who has influenced you greatly.",
  "What is your favorite season and why?",
  "Describe a perfect day from start to finish.",
  "If you could invent something, what would it be?",
  "Talk about a time you helped someone.",
  "What is the most beautiful place you have seen?",
  "If you could switch lives with someone for a day, who?",
  "Describe your dream house.",
  "What is a skill you think everyone should learn?",
  "Talk about a small thing that makes you happy.",
  "If you could have dinner with three famous people, who?",
  "Describe a memorable celebration you attended.",
  "What is your favorite way to relax after a busy day?",
  "If you could change one thing about the world, what?",
  "Talk about a time you tried something for the first time.",
  "What does success mean to you?",
  "Describe your favorite childhood memory.",
  "If you could speak another language fluently, which?",
  "Talk about a piece of technology you cannot live without.",
  "What is the most courageous thing you have done?",
  "Describe a lesson you learned the hard way.",
  "If you could travel back in time, what advice would you give your younger self?",
  "Talk about a goal you are currently working toward.",
  "What is your favorite form of exercise?",
  "Describe a tradition you would like to start.",
  "If you were an animal, what would you be?",
  "Talk about a time you felt really proud of yourself.",
  "What is the best gift you have ever received?",
  "Describe a place where you feel completely at peace.",
  "If you could eliminate one thing from your daily routine, what?",
  "Talk about a movie that made you think deeply.",
  "What is something you believed as a child that you no longer believe?",
  "Describe your ideal travel companion.",
  "If you were a teacher for a day, what would you teach?",
  "Talk about a risk that paid off.",
  "What is your favorite word and why?",
  "Describe a time you had to adapt to a new situation.",
  "If you could have any view from your window, what?",
  "Talk about something you collect or used to collect.",
  "What is the most interesting conversation you have had recently?",
  "Describe a time you felt like a complete beginner.",
  "If you could instantly master one instrument, which?",
  "Talk about your favorite time of day and why.",
];

export function getTodaysTopic(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
      1000 /
      60 /
      60 /
      24
  );
  return topics[dayOfYear % topics.length];
}

export function getAllTopics(): string[] {
  return topics;
}
