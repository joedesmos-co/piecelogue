import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dices,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { StudioHeading, PaperPanel, TapeStrip } from '../components/StudioKit'
import SegmentedControl from '../components/SegmentedControl'
import PromptWheel from '../components/PromptWheel'
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
  getWheelCandidates,
  getWheelDisplayLabel,
} from '../utils/promptEngine'
import { shouldReduceMotion } from '../utils/motionPreference'
import { getWheelTargetRotation, WHEEL_SPIN_DURATION_MS } from '../utils/promptWheel'

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

/**
 * Build the temporary face printed on the wheel for a category.
 *
 * The wheel is a readable object, not a database dump: only a slice of the
 * category pool is printed on it at any one time. The selected value is always
 * included, so the wheel can physically land on the result it produced.
 */
function buildWheelFace(category, selectedValue) {
  const values = getWheelCandidates(category, selectedValue)
  return values.map((value) => ({ value, label: getWheelDisplayLabel(value) }))
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
  const [wheelRound, setWheelRound] = useState(0)
  const [wheelSpinProgress, setWheelSpinProgress] = useState(4)
  const [wheelRerolling, setWheelRerolling] = useState(null)
  // The wheel always shows a temporary face built from the category being
  // spun. The selected value is guaranteed to be one of the visible slices so
  // the wheel can physically land on the result it produced.
  const [wheelFace, setWheelFace] = useState(() =>
    buildWheelFace('SUBJECT', wheelValues.SUBJECT),
  )
  // The value the pointer came to rest on. Only set once a spin lands, so the
  // winning slice is highlighted after the wheel settles.
  const [wheelPick, setWheelPick] = useState(() => ({
    category: 'SUBJECT',
    value: wheelValues.SUBJECT,
  }))
  // Start with the pointer already resting on the current subject pick.
  const [wheelRotation, setWheelRotation] = useState(() => {
    const index = Math.max(
      0,
      wheelFace.findIndex((slice) => slice.value === wheelValues.SUBJECT),
    )
    return getWheelTargetRotation(0, wheelFace.length, index, 0)
  })
  const wheelRotationRef = useRef(wheelRotation)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelInstant, setWheelInstant] = useState(false)
  const wheelTimersRef = useRef([])
  const wheelResolveRef = useRef(null)
  const wheelWaitResolveRef = useRef(null)
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
      const face = buildWheelFace(category, value)
      setWheelFace(face)
      const index = Math.max(0, face.findIndex((slice) => slice.value === value))
      const turns = reduceMotion
        ? 0
        : 5 + Math.floor(Math.random() * 3)
      const current = wheelRotationRef.current
      const final = getWheelTargetRotation(current, face.length, index, turns)
      wheelRotationRef.current = final
      setWheelRotation(final)

      const land = () => {
        setWheelPick({ category, value })
        resolve()
      }

      if (reduceMotion || skipWheelRef.current) {
        land()
        return
      }

      wheelResolveRef.current = land
      const timer = setTimeout(() => {
        wheelResolveRef.current = null
        land()
      }, WHEEL_SPIN_DURATION_MS)
      wheelTimersRef.current.push(timer)
    })
  }, [reduceMotion])

  const handleSkipWheel = useCallback(() => {
    skipWheelRef.current = true
    setWheelInstant(true)
    clearWheelTimers()
    if (wheelResolveRef.current) {
      const land = wheelResolveRef.current
      wheelResolveRef.current = null
      land()
    }
    if (wheelWaitResolveRef.current) {
      const resolve = wheelWaitResolveRef.current
      wheelWaitResolveRef.current = null
      resolve()
    }
  }, [clearWheelTimers])

  const handleSpinAll = useCallback(async () => {
    if (isWheelSpinning) return
    setIsWheelSpinning(true)
    setWheelInstant(false)
    skipWheelRef.current = false
    clearWheelTimers()
    setWheelSpinProgress(0)
    const categories = WHEEL_CATEGORIES
    const nextValues = { ...wheelValues }

    const wait = (ms) =>
      new Promise((resolve) => {
        if (reduceMotion || skipWheelRef.current) {
          resolve()
          return
        }
        const timer = setTimeout(() => {
          wheelTimersRef.current = wheelTimersRef.current.filter((t) => t !== timer)
          wheelWaitResolveRef.current = null
          resolve()
        }, ms)
        wheelTimersRef.current.push(timer)
        wheelWaitResolveRef.current = resolve
      })

    for (let i = 0; i < categories.length; i += 1) {
      if (skipWheelRef.current) {
        for (let j = i; j < categories.length; j += 1) {
          nextValues[categories[j]] = spinCategory(categories[j])
        }
        break
      }

      const cat = categories[i]
      setWheelRound(i + 1)
      setWheelCategory(cat)
      setWheelSpinProgress(i)
      const value = spinCategory(cat)
      nextValues[cat] = value
      await spinWheelToValue(cat, value)

      if (skipWheelRef.current) {
        for (let j = i + 1; j < categories.length; j += 1) {
          nextValues[categories[j]] = spinCategory(categories[j])
        }
        break
      }

      setWheelValues({ ...nextValues })
      setWheelSpinProgress(i + 1)

      if (!reduceMotion && !skipWheelRef.current && i < categories.length - 1) {
        await wait(300)
      }
    }

    const skipped = skipWheelRef.current
    const lastCat = categories[categories.length - 1]
    const lastValue = nextValues[lastCat]
    setWheelValues(nextValues)

    if (skipped) {
      setWheelCategory(lastCat)
      const face = buildWheelFace(lastCat, lastValue)
      const index = Math.max(0, face.findIndex((slice) => slice.value === lastValue))
      const final = getWheelTargetRotation(wheelRotationRef.current, face.length, index, 0)
      wheelRotationRef.current = final
      setWheelRotation(final)
      setWheelFace(face)
      setWheelPick({ category: lastCat, value: lastValue })
    }

    setWheelRound(0)
    setWheelSpinProgress(4)
    setIsWheelSpinning(false)
    skipWheelRef.current = false
    clearWheelTimers()
  }, [isWheelSpinning, wheelValues, spinWheelToValue, clearWheelTimers, reduceMotion])

  const handleSpinCategory = useCallback(
    async (category) => {
      if (isWheelSpinning) return
      setIsWheelSpinning(true)
      setWheelInstant(false)
      skipWheelRef.current = false
      clearWheelTimers()
      setWheelRerolling(category)
      setWheelCategory(category)
      const value = spinCategory(category)
      await spinWheelToValue(category, value)
      setWheelValues((prev) => ({ ...prev, [category]: value }))
      setWheelRerolling(null)
      setIsWheelSpinning(false)
      clearWheelTimers()
    },
    [isWheelSpinning, spinWheelToValue, clearWheelTimers],
  )

  const handleQuick = useCallback(() => {
    setQuickResult(generateQuickPrompt())
  }, [])

  const wheelPrompt = buildWheelPrompt(wheelValues)
  // The wheel highlights the value the pointer is resting on.
  const wheelHighlight = wheelPick.value ?? ''
  const wheelHubValue = getWheelDisplayLabel(wheelHighlight) || 'READY'

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
    <section
      className={`tools-page${activeTool === 'wheel' ? ' tools-page--wheel' : ''}`}
      aria-labelledby="tools-heading"
    >
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
        <PaperPanel className="tool-panel tool-panel--wheel" tone="bone">
          <div className="prompt-wheel-layout">
            <div className="prompt-wheel-col prompt-wheel-col--wheel">
              <p className="prompt-wheel-round" role="status" aria-live="polite">
                {wheelRerolling
                  ? `RE-SPINNING ${wheelRerolling}`
                  : isWheelSpinning
                  ? `ROUND ${wheelRound} OF ${WHEEL_CATEGORIES.length}`
                  : `${wheelCategory} · ${wheelFace.length} OPTIONS`}
              </p>
              <PromptWheel
                slices={wheelFace}
                category={wheelCategory}
                highlightValue={isWheelSpinning ? '' : wheelHighlight}
                hubValue={wheelHubValue}
                rotation={wheelRotation}
                spinning={isWheelSpinning}
                animated={!reduceMotion && !wheelInstant}
                onSpin={() => handleSpinCategory(wheelCategory)}
              />

              <div className="prompt-wheel-controls">
                <button
                  type="button"
                  className="btn btn--action prompt-wheel-spin-all"
                  onClick={handleSpinAll}
                  disabled={isWheelSpinning}
                  aria-label="Spin all wheel categories"
                >
                  {isWheelSpinning ? 'SPINNING…' : 'SPIN ALL'}
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

              <p className="tool-status" role="status" aria-live="polite">
                {isWheelSpinning
                  ? `Spinning ${wheelCategory.toLowerCase()}…`
                  : 'Spin the wheel, or re-spin a single pick.'}
              </p>
            </div>

            <div className="prompt-wheel-col prompt-wheel-col--results">
              <div className="prompt-wheel-roll">
                <p className="prompt-wheel-roll-title">YOUR ROLL</p>
                {WHEEL_CATEGORIES.map((cat, idx) => {
                  let displayValue = wheelValues[cat]
                  if (isWheelSpinning && wheelSpinProgress < 4) {
                    if (idx < wheelSpinProgress) {
                      displayValue = `${wheelValues[cat]} ✓`
                    } else if (idx === wheelSpinProgress) {
                      displayValue = 'SPINNING…'
                    } else {
                      displayValue = '—'
                    }
                  } else if (wheelRerolling === cat) {
                    displayValue = 'SPINNING…'
                  }
                  return (
                    <div className="prompt-wheel-roll-item" key={cat}>
                      <span className="prompt-wheel-roll-label">{cat}</span>
                      <span className="prompt-wheel-roll-value">{displayValue}</span>
                      <button
                        type="button"
                        className="btn btn--secondary prompt-wheel-roll-respin"
                        onClick={() => handleSpinCategory(cat)}
                        disabled={isWheelSpinning}
                        aria-label={`Re-spin ${cat}`}
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {!isWheelSpinning && (
                <div className="prompt-wheel-brief">
                  <TapeStrip className="prompt-wheel-brief-tape" angle={-7} />
                  <div className="prompt-wheel-prompt-card" role="status" aria-live="polite">
                    <p className="prompt-wheel-prompt-label">YOUR PROMPT</p>
                    <p className="prompt-wheel-prompt-text">“{wheelPrompt}”</p>
                  </div>
                </div>
              )}

              {!isWheelSpinning && (
                <div className="prompt-wheel-start">
                  <button
                    type="button"
                    className="btn btn--action prompt-wheel-start-btn"
                    onClick={() => startPiece(wheelPrompt)}
                    disabled={isWheelSpinning}
                  >
                    START THIS PIECE
                  </button>
                </div>
              )}
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
