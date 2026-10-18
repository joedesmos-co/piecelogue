// Local, offline prompt-generation engine for Piecelogue Tools.
// No network, no AI APIs. Curated arrays + template rules.

function makeRng(seed) {
  if (typeof seed === 'function') return seed
  if (seed == null) return Math.random
  // Mulberry32: deterministic, well-distributed, avoids low-seed correlation.
  let state = (Number(seed) >>> 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(arr, rng = Math.random) {
  if (!Array.isArray(arr) || arr.length === 0) return ''
  return arr[Math.floor(rng() * arr.length)]
}

function shuffle(arr, rng = Math.random) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/* ------------------------------------------------------------------ */
/* IDEA GENERATOR                                                      */
/* ------------------------------------------------------------------ */

export const IDEA_MEDIUMS = [
  'Any',
  'Pencil',
  'Colored pencil',
  'Marker',
  'Pen / Ink',
  'Paint',
  'Digital',
  'Charcoal',
  'Other',
]

export const IDEA_SUBJECTS = [
  'Any',
  'Character',
  'Creature',
  'Person',
  'Environment',
  'Object',
  'Vehicle',
  'Architecture',
  'Nature',
  'Abstract',
]

export const IDEA_MOODS = [
  'Any',
  'Peaceful',
  'Dark',
  'Weird',
  'Cozy',
  'Energetic',
  'Mysterious',
  'Funny',
  'Dramatic',
  'Nostalgic',
]

export const IDEA_TIMES = [
  'Any',
  '10 minutes',
  '20 minutes',
  '30 minutes',
  '1 hour',
  'Long project',
]

export const IDEA_DIFFICULTIES = ['Any', 'Easy', 'Normal', 'Challenging']

const SUBJECTS_BY_CATEGORY = {
  Character: [
    'a tired courier',
    'a street musician',
    'a librarian with too many books',
    'a night-shift baker',
    'a lost tourist',
    'a retired superhero',
    'a kid in oversized armor',
    'a wandering monk',
    'a postal worker on break',
    'a mechanic with grease on their hands',
  ],
  Creature: [
    'a moth-winged fox',
    'a small dragon with a cold',
    'a shy forest spirit',
    'a mechanical beetle',
    'a cloud-shaped animal',
    'a creature made of leaves',
    'a tiny griffin',
    'a frog with a lantern',
    'a snail with a tiny house',
    'a bird made of paper',
  ],
  Person: [
    'an old fisherman',
    'a young painter',
    'a tired nurse',
    'a smiling grandmother',
    'a skeptical scientist',
    'a hopeful astronaut',
    'a grumpy chef',
    'a daydreaming student',
    'a quiet gardener',
    'a brave firefighter',
  ],
  Environment: [
    'a rainy bus stop',
    'an overgrown greenhouse',
    'a quiet library corner',
    'a neon alley at night',
    'a sunlit kitchen',
    'a foggy harbor',
    'a cluttered workbench',
    'a rooftop garden',
    'an abandoned playground',
    'a cozy attic room',
  ],
  Object: [
    'an old refrigerator',
    'a dented lunchbox',
    'a vintage camera',
    'a cracked teapot',
    'a worn-out backpack',
    'a forgotten toy robot',
    'a music box',
    'a pair of boots',
    'a rusted key',
    'a paper lantern',
  ],
  Vehicle: [
    'a delivery robot',
    'a tiny submarine',
    'a bicycle with a basket',
    'a battered food truck',
    'a flying scooter',
    'a train car turned home',
    'a sailboat at dusk',
    'a drone carrying a package',
    'a rocket shaped like a teapot',
    'a car covered in plants',
  ],
  Architecture: [
    'an abandoned vending machine',
    'a lighthouse on a cliff',
    'a crooked tower',
    'a bridge made of books',
    'a house on stilts',
    'a tiny chapel',
    'a market stall',
    'a bus shelter',
    'a staircase to nowhere',
    'a greenhouse dome',
  ],
  Nature: [
    'a single old tree',
    'a field of wildflowers',
    'a mountain path',
    'a tide pool',
    'a desert cactus',
    'a forest clearing',
    'a river bend',
    'a snowy pine',
    'a cluster of mushrooms',
    'a sunflower field at sunset',
  ],
  Abstract: [
    'a tangle of ribbons',
    'a floating geometric shape',
    'a splash of ink',
    'a stack of impossible boxes',
    'a swirl of smoke',
    'a burst of confetti',
    'a pattern of circles',
    'a knot of string',
    'a cascade of triangles',
    'a field of dots',
  ],
}

const ALL_SUBJECTS = Object.values(SUBJECTS_BY_CATEGORY).flat()

const SETTINGS = [
  { text: 'at night', tags: ['ambient'] },
  { text: 'in the rain', tags: ['ambient'] },
  { text: 'at sunrise', tags: ['ambient'] },
  { text: 'in a quiet forest', tags: ['outdoor'] },
  { text: 'on a rooftop', tags: ['structure', 'urban'] },
  { text: 'in an abandoned mall', tags: ['indoor', 'urban'] },
  { text: 'by the sea', tags: ['waterDeep', 'shore'] },
  { text: 'in a busy market', tags: ['urban', 'indoor'] },
  { text: 'in a snowy field', tags: ['outdoor'] },
  { text: 'under a streetlight', tags: ['urban'] },
  { text: 'in a cluttered studio', tags: ['indoor'] },
  { text: 'on a train platform', tags: ['urban', 'transit'] },
  { text: 'in a desert', tags: ['outdoor'] },
  { text: 'in a foggy harbor', tags: ['waterDeep', 'shore'] },
  { text: 'in a small town', tags: ['urban', 'outdoor'] },
  { text: 'in a futuristic city', tags: ['urban'] },
  { text: 'in a village at dusk', tags: ['urban', 'outdoor'] },
  { text: 'in a cave', tags: ['outdoor'] },
  { text: 'on a bridge', tags: ['structure', 'outdoor'] },
  { text: 'in a garden', tags: ['outdoor'] },
  { text: 'in an old house', tags: ['indoor'] },
  { text: 'in a junkyard', tags: ['outdoor', 'urban'] },
  { text: 'on a hilltop', tags: ['outdoor'] },
  { text: 'in a subway car', tags: ['indoor', 'transit', 'urban'] },
  { text: 'in a classroom after hours', tags: ['indoor'] },
  { text: 'in a kitchen', tags: ['indoor'] },
  { text: 'in a greenhouse', tags: ['indoor'] },
  { text: 'on a beach', tags: ['shore', 'waterDeep'] },
  { text: 'in a forest clearing', tags: ['outdoor'] },
  { text: 'in a mountain pass', tags: ['outdoor'] },
  { text: 'at a bus stop', tags: ['urban', 'transit'] },
  { text: 'on a riverbank', tags: ['waterDeep', 'outdoor'] },
  { text: 'in a sunflower field', tags: ['outdoor'] },
]

const AGENT_TWISTS = [
  'waiting for the bus',
  'taking a break',
  'reading a book',
  'carrying something precious',
  'looking lost',
  'being followed by a small animal',
  'wearing a strange hat',
  'holding an umbrella',
  'sitting alone',
  'being chased',
  'offering something',
  'asleep',
  'waking up',
  'lost in thought',
  'being watched',
  'with a map in hand',
  'wearing boots too big',
  'in the middle of a conversation',
]

const SCENE_TWISTS = [
  'being reclaimed by plants',
  'glowing softly',
  'falling apart',
  'being repaired',
  'covered in stickers',
  'surrounded by books',
  'with a tiny garden on top',
  'being used as a shelter',
  'caught in the wind',
  'covered in snow',
  'reflected in a puddle',
  'being painted',
  'abandoned and overgrown',
]

const MOOD_PHRASES = {
  Peaceful: 'with a calm, quiet mood',
  Dark: 'with a dark, heavy mood',
  Weird: 'with a strange, offbeat mood',
  Cozy: 'with a warm, cozy mood',
  Energetic: 'with a lively, energetic mood',
  Mysterious: 'with a mysterious mood',
  Funny: 'with a funny, lighthearted mood',
  Dramatic: 'with a dramatic mood',
  Nostalgic: 'with a nostalgic mood',
}

const TIME_PREFIX = {
  '10 minutes': 'Quick sketch — ',
  '20 minutes': 'Short piece — ',
  '30 minutes': 'Focused study — ',
  '1 hour': 'Detailed drawing — ',
  'Long project': 'Ambitious piece — ',
}

const MEDIUM_VERBS = {
  Pencil: 'Sketch',
  'Colored pencil': 'Draw',
  Marker: 'Draw',
  'Pen / Ink': 'Ink',
  Paint: 'Paint',
  Digital: 'Design',
  Charcoal: 'Sketch',
  Other: 'Draw',
  Any: 'Draw',
}

function normalizeFilter(value, fallback = 'Any') {
  return value && value !== '' ? value : fallback
}

const SUBJECT_CATEGORIES = Object.keys(SUBJECTS_BY_CATEGORY)

// Which setting "kinds" each subject category can plausibly sit in.
const SETTING_TAGS_BY_CATEGORY = {
  Character: ['ambient', 'urban', 'indoor', 'outdoor', 'transit', 'shore'],
  Person: ['ambient', 'urban', 'indoor', 'outdoor', 'transit', 'shore'],
  Creature: ['ambient', 'urban', 'indoor', 'outdoor', 'transit', 'shore', 'waterDeep', 'structure'],
  Environment: [],
  Object: ['ambient', 'urban', 'indoor', 'outdoor'],
  Vehicle: ['ambient', 'urban', 'outdoor', 'transit'],
  Architecture: ['ambient', 'urban', 'outdoor', 'shore'],
  Nature: ['ambient', 'outdoor', 'shore', 'waterDeep'],
  Abstract: [],
}

const TWISTS_BY_CATEGORY = {
  Character: AGENT_TWISTS,
  Person: AGENT_TWISTS,
  Creature: [...AGENT_TWISTS, ...SCENE_TWISTS],
  Environment: SCENE_TWISTS,
  Object: SCENE_TWISTS,
  Vehicle: SCENE_TWISTS,
  Architecture: SCENE_TWISTS,
  Nature: SCENE_TWISTS,
  Abstract: [],
}

function isWaterSubject(subject) {
  return /submarine|sailboat|boat|ship|canoe|kayak|raft/i.test(subject)
}

function pickSubjectWithCategory(category, rng) {
  const requested = normalizeFilter(category, 'Any')
  let cat = requested
  if (cat === 'Any' || !SUBJECTS_BY_CATEGORY[cat]) {
    cat = pick(SUBJECT_CATEGORIES, rng)
  }
  const pool = SUBJECTS_BY_CATEGORY[cat] || ALL_SUBJECTS
  return { category: cat, subject: pick(pool, rng) }
}

function pickSetting(subject, category, rng) {
  let tags = SETTING_TAGS_BY_CATEGORY[category] || []
  let exclude = []
  if (category === 'Vehicle') {
    if (isWaterSubject(subject)) {
      // Boats/submarines only make sense in water or at the shore.
      tags = ['ambient', 'shore', 'waterDeep']
    } else {
      // Land vehicles: no deep water, no bridges/structures.
      tags = ['ambient', 'urban', 'outdoor', 'transit']
      exclude = ['structure', 'waterDeep', 'indoor']
    }
  } else if (category === 'Architecture' || category === 'Nature') {
    exclude = ['structure', 'transit']
  }
  const pool = SETTINGS.filter(
    (s) => s.tags.some((tag) => tags.includes(tag)) && !s.tags.some((tag) => exclude.includes(tag)),
  )
  if (pool.length === 0) return ''
  return pick(pool, rng).text
}

function pickTwist(category, rng) {
  const pool = TWISTS_BY_CATEGORY[category] || []
  if (pool.length === 0) return ''
  return pick(pool, rng)
}

export function generateIdea(options = {}, rngInput) {
  const opts = typeof options === 'string' ? { subject: options } : (options || {})
  const rng = makeRng(opts.rng ?? rngInput ?? opts.seed)
  const medium = normalizeFilter(opts.medium, 'Any')
  const subjectCat = normalizeFilter(opts.subject, 'Any')
  const mood = normalizeFilter(opts.mood, 'Any')
  const time = normalizeFilter(opts.time, 'Any')
  const difficulty = normalizeFilter(opts.difficulty, 'Any')

  const verb = MEDIUM_VERBS[medium] || 'Draw'
  const { category, subject } = pickSubjectWithCategory(subjectCat, rng)
  const setting = pickSetting(subject, category, rng)
  const twist = pickTwist(category, rng)
  const moodPhrase = mood !== 'Any' ? (MOOD_PHRASES[mood] || `with a ${mood.toLowerCase()} mood`) : ''

  const prefix = TIME_PREFIX[time] || ''

  const parts = [subject]
  if (twist) parts.push(twist)
  if (setting) parts.push(setting)
  let body = parts.join(' ') + '.'

  const diff = difficulty === 'Any' ? (rng() < 0.34 ? 'Easy' : rng() < 0.67 ? 'Normal' : 'Challenging') : difficulty
  if (diff === 'Easy') {
    body = `${subject}.`
  } else if (diff === 'Normal') {
    body = setting ? `${subject} ${setting}.` : twist ? `${subject} ${twist}.` : `${subject}.`
  }

  let sentence = `${verb} ${body}`
  if (moodPhrase) {
    sentence = sentence.replace(/\.$/, '') + `, ${moodPhrase}.`
  }
  return `${prefix}${sentence}`.trim()
}

export const generateIdeaPrompt = generateIdea

export function surpriseMe(options = {}) {
  return generateIdea({ ...options, medium: 'Any', subject: 'Any', mood: 'Any', time: 'Any', difficulty: 'Any' }, options?.rng ?? options?.seed)
}

/* ------------------------------------------------------------------ */
/* ART CHALLENGE                                                      */
/* ------------------------------------------------------------------ */

export const CHALLENGE_DIFFICULTIES = ['CHILL', 'NORMAL', 'HARD']

const TIME_CHALLENGES = [
  { text: '5-minute sketch', levels: ['CHILL'] },
  { text: '10-minute sketch', levels: ['CHILL', 'NORMAL'] },
  { text: '20-minute challenge', levels: ['NORMAL'] },
  { text: '1-hour piece', levels: ['HARD'] },
]

const COLOR_CHALLENGES = [
  { text: 'only 3 colors', levels: ['CHILL', 'NORMAL', 'HARD'] },
  { text: 'monochrome', levels: ['CHILL', 'NORMAL', 'HARD'] },
  { text: 'complementary colors', levels: ['NORMAL', 'HARD'] },
  { text: 'one accent color', levels: ['CHILL', 'NORMAL'] },
]

const TECHNIQUE_CHALLENGES = [
  { text: 'no erasing', levels: ['CHILL', 'NORMAL', 'HARD'] },
  { text: 'continuous line', levels: ['NORMAL', 'HARD'] },
  { text: 'non-dominant hand', levels: ['HARD'] },
  { text: 'silhouettes only', levels: ['NORMAL', 'HARD'] },
  { text: 'no outlines', levels: ['NORMAL', 'HARD'] },
  { text: 'only straight lines', levels: ['HARD'] },
  { text: 'only basic shapes', levels: ['CHILL', 'NORMAL'] },
  { text: 'one brush', levels: ['CHILL', 'NORMAL'] },
  { text: 'one pencil', levels: ['CHILL', 'NORMAL'] },
]

const CREATIVE_CHALLENGES = [
  { text: 'redesign an everyday object', levels: ['CHILL', 'NORMAL'] },
  { text: 'combine two unrelated things', levels: ['NORMAL', 'HARD'] },
  { text: 'draw a familiar object from memory', levels: ['CHILL', 'NORMAL'] },
  { text: 'turn an animal into a vehicle', levels: ['NORMAL', 'HARD'] },
  { text: 'create something from three random shapes', levels: ['NORMAL', 'HARD'] },
  { text: 'make a character based on a household object', levels: ['CHILL', 'NORMAL'] },
  { text: 'redesign something from childhood', levels: ['CHILL', 'NORMAL', 'HARD'] },
]

function filterByLevel(items, level) {
  return items.filter((item) => item.levels.includes(level))
}

export function generateChallenge(options = {}, rngInput) {
  const opts = typeof options === 'string' ? { difficulty: options } : (options || {})
  const rng = makeRng(opts.rng ?? rngInput ?? opts.seed)
  let difficulty = (opts.difficulty || opts.level || 'NORMAL').toUpperCase()
  if (!CHALLENGE_DIFFICULTIES.includes(difficulty)) difficulty = 'NORMAL'

  const timePool = filterByLevel(TIME_CHALLENGES, difficulty)
  const colorPool = filterByLevel(COLOR_CHALLENGES, difficulty)
  const techPool = filterByLevel(TECHNIQUE_CHALLENGES, difficulty)
  const creativePool = filterByLevel(CREATIVE_CHALLENGES, difficulty)

  const time = pick(timePool, rng).text
  const color = pick(colorPool, rng).text
  const technique = pick(techPool, rng).text
  const creative = pick(creativePool, rng).text

  // Build instruction: time sets duration phrase; include 2 of color/technique/creative
  const extras = shuffle([color, technique, creative], rng).slice(0, 2)
  // Keep it concise: one creative + one color + one technique
  const instruction = `Create a piece: ${creative}. Use ${color}. ${technique.charAt(0).toUpperCase() + technique.slice(1)}.`

  const title = `${time.toUpperCase()} CHALLENGE`.replace('CHALLENGE CHALLENGE', 'CHALLENGE')
  const text = `${title}\n\n${instruction}`
  return {
    difficulty,
    time,
    color,
    technique,
    creative,
    extras,
    title,
    prompt: instruction,
    text,
    toString() { return text },
  }
}

export const generateArtChallenge = generateChallenge

/* ------------------------------------------------------------------ */
/* PROMPT WHEEL                                                       */
/* ------------------------------------------------------------------ */

export const WHEEL_CATEGORIES = ['SUBJECT', 'MOOD', 'SETTING', 'CONSTRAINT']

export const WHEEL_SUBJECTS = [
  'robot',
  'knight',
  'creature',
  'astronaut',
  'witch',
  'detective',
  'mechanic',
  'gardener',
  'musician',
  'traveler',
  'librarian',
  'chef',
]

export const WHEEL_MOODS = [
  'lonely',
  'cozy',
  'mysterious',
  'playful',
  'tired',
  'hopeful',
  'grumpy',
  'gentle',
  'dramatic',
  'nostalgic',
]

export const WHEEL_SETTINGS = [
  'in an abandoned mall',
  'on a rainy rooftop',
  'at a quiet bus stop',
  'in a foggy harbor',
  'in a cluttered studio',
  'on a hilltop at dusk',
  'in a neon alley',
  'in a sunlit kitchen',
  'in a junkyard',
  'in a snowy forest',
  'on a train platform',
  'in an overgrown greenhouse',
]

export const WHEEL_CONSTRAINTS = [
  'using only three colors',
  'with no erasing',
  'in monochrome',
  'with one accent color',
  'using only basic shapes',
  'with continuous line',
  'with no outlines',
  'using one pencil',
]

export function spinCategory(category, currentOrRng, rngInput) {
  const rng = makeRng(typeof currentOrRng === 'function' ? currentOrRng : rngInput)
  const cat = String(category || '').toUpperCase()
  if (cat === 'SUBJECT') return pick(WHEEL_SUBJECTS, rng)
  if (cat === 'MOOD') return pick(WHEEL_MOODS, rng)
  if (cat === 'SETTING') return pick(WHEEL_SETTINGS, rng)
  if (cat === 'CONSTRAINT') return pick(WHEEL_CONSTRAINTS, rng)
  return pick(WHEEL_SUBJECTS, rng)
}

export function spinAll(seedOrCurrent, seed) {
  const rng = makeRng(typeof seedOrCurrent === 'function' ? seedOrCurrent : (seed ?? (typeof seedOrCurrent === 'number' ? seedOrCurrent : undefined)))
  return {
    SUBJECT: pick(WHEEL_SUBJECTS, rng),
    MOOD: pick(WHEEL_MOODS, rng),
    SETTING: pick(WHEEL_SETTINGS, rng),
    CONSTRAINT: pick(WHEEL_CONSTRAINTS, rng),
  }
}

export function buildWheelPrompt(values) {
  const v = values || {}
  const subject = v.SUBJECT || v.subject || 'subject'
  const mood = v.MOOD || v.mood || 'mood'
  const setting = v.SETTING || v.setting || 'setting'
  const constraint = v.CONSTRAINT || v.constraint || 'constraint'
  // natural phrasing
  return `Create a ${mood} ${subject} ${setting} ${constraint}.`
}

/* ------------------------------------------------------------------ */
/* QUICK PROMPT                                                       */
/* ------------------------------------------------------------------ */

export const QUICK_PROMPTS = [
  'Draw a knight waiting for the bus.',
  'Design a sneaker for someone living underwater.',
  'Draw your bedroom as if it were abandoned for 100 years.',
  'Turn a household appliance into a boss fight.',
  'Draw a tiny civilization living inside a backpack.',
  'Design a tired delivery robot taking a break on a rainy rooftop.',
  'Draw an abandoned vending machine being reclaimed by plants at night.',
  'Sketch a street musician playing to an audience of pigeons.',
  'Draw a librarian organizing books in a floating library.',
  'Design a frog with a lantern guiding travelers through fog.',
  'Draw a small dragon with a cold, curled up by a fire.',
  'Sketch an old fisherman mending nets at dawn.',
  'Draw a mechanical beetle carrying a tiny house on its back.',
  'Design a flying scooter parked outside a noodle shop.',
  'Draw a creature made of leaves hiding in a garden.',
  'Sketch a retired superhero waiting at a bus stop.',
  'Draw a cloud-shaped animal drifting over a city.',
  'Design a submarine shaped like a teapot exploring a reef.',
  'Draw a house on stilts above a flooded street.',
  'Sketch a musician playing a guitar on a rooftop at sunset.',
  'Draw a lost tourist reading a map in a neon alley.',
  'Design a car covered in plants parked in a junkyard.',
  'Draw a tiny chapel on a snowy hilltop.',
  'Sketch a mechanic with grease on their hands fixing a robot.',
  'Draw a mountain path winding through wildflowers.',
  'Design a bridge made of books spanning a river.',
  'Draw a snail with a tiny house on its shell.',
  'Sketch a nurse taking a quiet break in a hospital corridor.',
  'Draw a bird made of paper flying through a rainy street.',
  'Design a market stall selling impossible objects.',
  'Draw a staircase to nowhere in a foggy forest.',
  'Sketch a gardener tending a rooftop garden at dawn.',
  'Draw a train car turned into a cozy home.',
  'Design a drone carrying a package through a storm.',
  'Draw a tide pool full of tiny creatures.',
  'Sketch a chef cooking in a cluttered kitchen.',
  'Draw a lighthouse on a cliff in a storm.',
  'Design a rocket shaped like a teapot launching into space.',
  'Draw a snowy pine standing alone on a hill.',
  'Sketch a student daydreaming in a classroom after hours.',
  'Draw a cluster of mushrooms glowing in a cave.',
  'Design a sailboat at dusk on a calm sea.',
  'Draw an astronaut planting a flag on a strange planet.',
  'Sketch a grumpy cat sitting on a pile of books.',
  'Draw a fox wearing a tiny scarf in the snow.',
  'Design a bicycle with a basket full of flowers.',
  'Draw a teapot with legs walking through a forest.',
  'Sketch a dog wearing boots too big for its feet.',
  'Draw a city built inside a giant bottle.',
  'Design a backpack that contains a whole tiny world.',
]

export function generateQuickPrompt(rngInput) {
  const rng = makeRng(rngInput)
  return pick(QUICK_PROMPTS, rng)
}

export const getQuickPrompt = generateQuickPrompt

// Back-compat / alias helpers
export const generatePrompt = generateIdea
export const generateWheelPrompt = buildWheelPrompt
export const spinWheel = spinAll

export default {
  generateIdea,
  generateIdeaPrompt,
  surpriseMe,
  generateChallenge,
  generateArtChallenge,
  spinCategory,
  spinAll,
  spinWheel,
  buildWheelPrompt,
  generateQuickPrompt,
  getQuickPrompt,
  QUICK_PROMPTS,
}
