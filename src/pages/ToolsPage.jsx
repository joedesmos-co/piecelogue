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
} from '../utils/promptEngine'

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

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

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
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const wheelTimer = useRef(null)

  // QUICK state
  const [quickResult, setQuickResult] = useState('')

  useEffect(() => {
    return () => {
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
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

  const animateWheel = useCallback((cb) => {
    if (prefersReducedMotion()) {
      cb()
      return
    }
    setWheelSpinning(true)
    setWheelRotation((r) => r + 720)
    if (wheelTimer.current) clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => {
      cb()
      setWheelSpinning(false)
    }, 420)
  }, [])

  const handleSpinAll = useCallback(() => {
    animateWheel(() => {
      setWheelValues(spinAll())
    })
  }, [animateWheel])

  const handleSpinCategory = useCallback(
    (category) => {
      animateWheel(() => {
        setWheelValues((prev) => ({
          ...prev,
          [category]: spinCategory(category),
        }))
      })
    },
    [animateWheel],
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
          <div className="prompt-wheel-wrap" aria-hidden="true">
            <div
              className={`prompt-wheel ${wheelSpinning ? 'prompt-wheel--spinning' : ''}`}
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              <span className="prompt-wheel-label">SPIN</span>
            </div>
          </div>

          <div className="tool-actions">
            <button
              type="button"
              className="btn btn--action"
              onClick={handleSpinAll}
            >
              SPIN ALL
            </button>
          </div>

          <div className="wheel-rows">
            {WHEEL_CATEGORIES.map((cat) => (
              <div className="wheel-row" key={cat}>
                <span className="wheel-row-label">{cat}</span>
                <span className="wheel-row-value">{wheelValues[cat]}</span>
                <button
                  type="button"
                  className="btn btn--secondary wheel-row-spin"
                  onClick={() => handleSpinCategory(cat)}
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
              >
                START THIS PIECE
              </button>
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
