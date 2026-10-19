import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dices,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { StudioHeading, PaperPanel } from '../components/StudioKit'
import SegmentedControl from '../components/SegmentedControl'
import {
  IDEA_MEDIUMS,
  IDEA_SUBJECTS,
  IDEA_MOODS,
  IDEA_TIMES,
  IDEA_DIFFICULTIES,
  generateIdea,
  surpriseMe,
  generateChallenge,
  CHALLENGE_DIFFICULTIES,
  WHEEL_CATEGORIES,
  spinAll,
  spinCategory,
  buildWheelPrompt,
  generateQuickPrompt,
  QUICK_PROMPTS,
  WHEEL_SUBJECTS,
  WHEEL_MOODS,
  WHEEL_SETTINGS,
  WHEEL_CONSTRAINTS,
} from '../utils/promptEngine'
import { shouldReduceMotion } from '../utils/motionPreference'
import { getWheelTargetRotation, getWheelSelectedIndex } from '../utils/promptWheel'

// tolerant prop names for "start this piece"
function resolveStartPiece(props) {
  return (
    props.onStartPiece ||
    props.onStartThisPiece ||
    props.onStartArtwork ||
    props.onAddArtwork ||
    (() => {})
  )
}

const WHEEL_OPTIONS = {
  SUBJECT: WHEEL_SUBJECTS,
  MOOD: WHEEL_MOODS,
  SETTING: WHEEL_SETTINGS,
  CONSTRAINT: WHEEL_CONSTRAINTS,
}

const TOOL_CARDS = [
  {
    id: 'idea',
    name: 'Idea Generator',
    description: 'Pick a few preferences. Get a drawable idea.',
    icon: Lightbulb,
  },
  {
    id: 'challenge',
    name: 'Art Challenge',
    description: 'Constraints that make creating fun.',
    icon: Zap,
  },
  {
    id: 'wheel',
    name: 'Prompt Wheel',
    description: 'Spin for a subject, mood, setting, constraint.',
    icon: Dices,
  },
  {
    id: 'quick',
    name: 'Quick Prompt',
    description: 'One tap. Something to draw.',
    icon: Sparkles,
  },
]

export default function ToolsPage(props) {
  const startPiece = resolveStartPiece(props)
  const [activeTool, setActiveTool] = useState(null)

  // IDEA state
  const [ideaMedium, setIdeaMedium] = useState('Any')
  const [ideaSubject, setIdeaSubject] = useState('Any')
  const [ideaMood, setIdeaMood] = useState('Any')
  const [ideaTime, setIdeaTime] = useState('Any')
  const [ideaDifficulty, setIdeaDifficulty] = useState('Any')
  const [ideaResult, setIdeaResult] = useState('')

  // CHALLENGE state
  const [challengeDifficulty, setChallengeDifficulty] = useState('NORMAL')
  const [challengeResult, setChallengeResult] = useState(null)

  // WHEEL state
  const [wheelValues, setWheelValues] = useState(() => spinAll())
  const [wheelCategory, setWheelCategory] = useState('SUBJECT')
  const [wheelRotation, setWheelRotation] = useState(0)
  const wheelRotationRef = useRef(0)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const wheelTimersRef = useRef([])
  const wheelResolveRef = useRef(null)
  const skipWheelRef = useRef(false)

  // QUICK state
  const [quickResult, setQuickResult] = useState('')

  useEffect(() => {
    return () => {
      wheelTimersRef.current.forEach((timer) => {
        clearTimeout(timer)
        clearInterval(timer)
      })
      wheelTimersRef.current = []
    }
  }, [])

  const handleGenerateIdea = useCallback(() => {
    const prompt = generateIdea({
      medium: ideaMedium,
      subject: ideaSubject,
      mood: ideaMood,
      time: ideaTime,
      difficulty: ideaDifficulty,
    })
    setIdeaResult(prompt)
  }, [ideaMedium, ideaSubject, ideaMood, ideaTime, ideaDifficulty])

  const handleSurpriseMe = useCallback(() => {
    setIdeaMedium('Any')
    setIdeaSubject('Any')
    setIdeaMood('Any')
    setIdeaTime('Any')
    setIdeaDifficulty('Any')
    const prompt = surpriseMe()
    setIdeaResult(prompt)
  }, [])

  const handleGenerateChallenge = useCallback(() => {
    const result = generateChallenge({ difficulty: challengeDifficulty })
    setChallengeResult(result)
  }, [challengeDifficulty])

  const reduceMotion = shouldReduceMotion()

  const clearWheelTimers = useCallback(() => {
    wheelTimersRef.current.forEach((timer) => {
      clearTimeout(timer)
      clearInterval(timer)
    })
    wheelTimersRef.current = []
  }, [])

  const spinWheelToValue = useCallback((category, value) => {
    return new Promise((resolve) => {
      const options = WHEEL_OPTIONS[category]
      const index = getWheelSelectedIndex(options, value)
      const turns = reduceMotion ? 0 : 3
      const current = wheelRotationRef.current
      const final = getWheelTargetRotation(current, options.length, index, turns)
      wheelRotationRef.current = final
      setWheelRotation(final)

      if (reduceMotion) {
        resolve()
        return
      }

      wheelResolveRef.current = resolve
      const duration = 460
      const timer = setTimeout(() => {
        wheelResolveRef.current = null
        resolve()
      }, duration)
      wheelTimersRef.current.push(timer)
    })
  }, [reduceMotion])

  const handleSkipWheel = useCallback(() => {
    skipWheelRef.current = true
    clearWheelTimers()
    if (wheelResolveRef.current) {
      const resolve = wheelResolveRef.current
      wheelResolveRef.current = null
      resolve()
    }
  }, [clearWheelTimers])

  const handleSpinAll = useCallback(async () => {
    if (isWheelSpinning) return
    setIsWheelSpinning(true)
    skipWheelRef.current = false
    clearWheelTimers()
    const categories = WHEEL_CATEGORIES
    const nextValues = { ...wheelValues }

    for (let i = 0; i < categories.length; i += 1) {
      if (skipWheelRef.current) {
        for (let j = i; j < categories.length; j += 1) {
          nextValues[categories[j]] = spinCategory(categories[j])
        }
        setWheelValues(nextValues)
        setWheelCategory(categories[categories.length - 1])
        break
      }

      const cat = categories[i]
      setWheelCategory(cat)
      const value = spinCategory(cat)
      nextValues[cat] = value
      await spinWheelToValue(cat, value)

      if (skipWheelRef.current) {
        for (let j = i + 1; j < categories.length; j += 1) {
          nextValues[categories[j]] = spinCategory(categories[j])
        }
        setWheelValues(nextValues)
        setWheelCategory(categories[categories.length - 1])
        break
      }

      setWheelValues({ ...nextValues })
    }

    if (!skipWheelRef.current) {
      setWheelValues(nextValues)
    }

    setIsWheelSpinning(false)
    skipWheelRef.current = false
    clearWheelTimers()
  }, [isWheelSpinning, wheelValues, spinWheelToValue, clearWheelTimers])

  const handleSpinCategory = useCallback(
    async (category) => {
      if (isWheelSpinning) return
      setIsWheelSpinning(true)
      skipWheelRef.current = false
      clearWheelTimers()
      setWheelCategory(category)
      const value = spinCategory(category)
      await spinWheelToValue(category, value)
      setWheelValues((prev) => ({ ...prev, [category]: value }))
      setIsWheelSpinning(false)
      clearWheelTimers()
    },
    [isWheelSpinning, spinWheelToValue, clearWheelTimers],
  )

  const handleQuick = useCallback(() => {
    setQuickResult(generateQuickPrompt())
  }, [])

  const wheelPrompt = buildWheelPrompt(wheelValues)

  // HOME
  if (!activeTool) {
    return (
      <section className="tools-page" aria-labelledby="tools-heading">
        <StudioHeading
          id="tools-heading"
          title="TOOLS"
          note="Something to make when you don't know what to make."
        />

        <div className="tools-grid" role="list">
          {TOOL_CARDS.map(({ id, name, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="tool-card"
              onClick={() => setActiveTool(id)}
              role="listitem"
            >
              <span className="tool-card-icon" aria-hidden="true">
                <Icon size={26} strokeWidth={1.75} />
              </span>
              <span className="tool-card-name">{name}</span>
              <span className="tool-card-desc">{description}</span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  const activeCard = TOOL_CARDS.find((t) => t.id === activeTool)

  return (
    <section className="tools-page" aria-labelledby="tools-heading">
      <div className="tools-back-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setActiveTool(null)}
        >
          ← Tools
        </button>
      </div>

      <StudioHeading id="tools-heading" title="TOOLS" />
      {activeCard && (
        <p className="tool-subheading">{activeCard.name}</p>
      )}

      {activeTool === 'idea' && (
        <PaperPanel className="tool-panel" tone="bone">
          <div className="tool-controls">
            <SegmentedControl
              label="Medium"
              labelId="idea-medium-label"
              options={IDEA_MEDIUMS}
              value={ideaMedium}
              onChange={setIdeaMedium}
              columns={3}
            />
            <SegmentedControl
              label="Subject"
              labelId="idea-subject-label"
              options={IDEA_SUBJECTS}
              value={ideaSubject}
              onChange={setIdeaSubject}
              columns={3}
            />
            <SegmentedControl
              label="Mood"
              labelId="idea-mood-label"
              options={IDEA_MOODS}
              value={ideaMood}
              onChange={setIdeaMood}
              columns={3}
            />
            <SegmentedControl
              label="Time"
              labelId="idea-time-label"
              options={IDEA_TIMES}
              value={ideaTime}
              onChange={setIdeaTime}
              columns={3}
            />
            <SegmentedControl
              label="Difficulty"
              labelId="idea-difficulty-label"
              options={IDEA_DIFFICULTIES}
              value={ideaDifficulty}
              onChange={setIdeaDifficulty}
              columns={3}
            />
          </div>

          <div className="tool-actions">
            <button
              type="button"
              className="btn btn--action"
              onClick={handleGenerateIdea}
            >
              GENERATE IDEA
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleSurpriseMe}
            >
              SURPRISE ME
            </button>
          </div>

          {ideaResult && (
            <div className="tool-result" role="status" aria-live="polite">
              <p className="tool-result-text">{ideaResult}</p>
              <div className="tool-result-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleGenerateIdea}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  className="btn btn--action"
                  onClick={() => startPiece(ideaResult)}
                >
                  START THIS PIECE
                </button>
              </div>
            </div>
          )}
        </PaperPanel>
      )}

      {activeTool === 'challenge' && (
        <PaperPanel className="tool-panel" tone="bone">
          <SegmentedControl
            label="Difficulty"
            labelId="challenge-difficulty-label"
            options={CHALLENGE_DIFFICULTIES}
            value={challengeDifficulty}
            onChange={setChallengeDifficulty}
            columns={3}
          />

          <div className="tool-actions">
            <button
              type="button"
              className="btn btn--action"
              onClick={handleGenerateChallenge}
            >
              NEW CHALLENGE
            </button>
          </div>

          {challengeResult && (
            <div className="tool-result" role="status" aria-live="polite">
              <p className="tool-result-title">{challengeResult.title}</p>
              <p className="tool-result-text">{challengeResult.prompt}</p>
              <div className="tool-result-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleGenerateChallenge}
                >
                  NEW CHALLENGE
                </button>
                <button
                  type="button"
                  className="btn btn--action"
                  onClick={() => startPiece(challengeResult.prompt)}
                >
                  START THIS PIECE
                </button>
              </div>
            </div>
          )}
        </PaperPanel>
      )}

      {activeTool === 'wheel' && (
        <PaperPanel className="tool-panel" tone="bone">
          <div className="prompt-wheel-layout">
            <div className="prompt-wheel-stage" aria-hidden="true">
              <div className="prompt-wheel-pointer" />
              <svg
                className="prompt-wheel-svg"
                viewBox="0 0 280 280"
                width="280"
                height="280"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  transition: reduceMotion || isWheelSpinning === false
                    ? 'none'
                    : 'transform 460ms cubic-bezier(0.18, 0.72, 0.22, 1)',
                }}
              >
                {(() => {
                  const options = WHEEL_OPTIONS[wheelCategory]
                  const n = options.length
                  const seg = 360 / n
                  const cx = 140
                  const cy = 140
                  const r = 128
                  function polar(angle) {
                    const rad = (angle - 90) * Math.PI / 180
                    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
                  }
                  return options.map((option, index) => {
                    const start = index * seg
                    const end = start + seg
                    const s = polar(start)
                    const e = polar(end)
                    const large = seg > 180 ? 1 : 0
                    const path = `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`
                    const mid = start + seg / 2
                    const lx = cx + (r * 0.62) * Math.cos((mid - 90) * Math.PI / 180)
                    const ly = cy + (r * 0.62) * Math.sin((mid - 90) * Math.PI / 180)
                    const label = String(option).length > 14 ? String(option).slice(0, 12) + '…' : option
                    return (
                      <g key={`${option}-${index}`}>
                        <path
                          d={path}
                          className={index % 2 === 0 ? 'prompt-wheel-slice prompt-wheel-slice--even' : 'prompt-wheel-slice prompt-wheel-slice--odd'}
                        />
                        <text
                          x={lx}
                          y={ly}
                          className="prompt-wheel-slice-label"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${mid} ${lx} ${ly})`}
                        >
                          {label}
                        </text>
                      </g>
                    )
                  })
                })()}
                <circle cx="140" cy="140" r="34" className="prompt-wheel-hub" />
                <text x="140" y="136" className="prompt-wheel-hub-label" textAnchor="middle">
                  {wheelCategory}
                </text>
                <text x="140" y="152" className="prompt-wheel-hub-sub" textAnchor="middle">
                  {isWheelSpinning ? 'SPINNING' : 'READY'}
                </text>
              </svg>
            </div>

            <div className="tool-actions">
              <button
                type="button"
                className="btn btn--action"
                onClick={handleSpinAll}
                disabled={isWheelSpinning}
                aria-label="Spin all wheel categories"
              >
                SPIN ALL
              </button>
              {isWheelSpinning && !reduceMotion && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleSkipWheel}
                >
                  SKIP ANIMATION
                </button>
              )}
            </div>

            {isWheelSpinning && (
              <p className="tool-status" role="status" aria-live="polite">
                Spinning {wheelCategory.toLowerCase()}...
              </p>
            )}

            <div className="wheel-rows">
              {WHEEL_CATEGORIES.map((cat) => (
                <div className="wheel-row" key={cat}>
                  <span className="wheel-row-label">{cat}</span>
                  <span className="wheel-row-value">{wheelValues[cat]}</span>
                  <button
                    type="button"
                    className="btn btn--secondary wheel-row-spin"
                    onClick={() => handleSpinCategory(cat)}
                    disabled={isWheelSpinning}
                    aria-label={`Re-spin ${cat}`}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="tool-result" role="status" aria-live="polite">
              <p className="tool-result-text">{wheelPrompt}</p>
              <div className="tool-result-actions">
                <button
                  type="button"
                  className="btn btn--action"
                  onClick={() => startPiece(wheelPrompt)}
                  disabled={isWheelSpinning}
                >
                  START THIS PIECE
                </button>
              </div>
            </div>
          </div>
        </PaperPanel>
      )}

      {activeTool === 'quick' && (
        <PaperPanel className="tool-panel" tone="bone">
          <div className="tool-actions">
            <button
              type="button"
              className="btn btn--action"
              onClick={handleQuick}
            >
              GIVE ME SOMETHING TO DRAW
            </button>
          </div>

          {quickResult && (
            <div className="tool-result" role="status" aria-live="polite">
              <p className="tool-result-text">{quickResult}</p>
              <div className="tool-result-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleQuick}
                >
                  ANOTHER
                </button>
                <button
                  type="button"
                  className="btn btn--action"
                  onClick={() => startPiece(quickResult)}
                >
                  START THIS PIECE
                </button>
              </div>
            </div>
          )}
        </PaperPanel>
      )}
    </section>
  )
}

// re-export for convenience
export { QUICK_PROMPTS }
