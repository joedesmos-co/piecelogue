import { LoaderCircle } from 'lucide-react'

export default function LoadingState({ message = 'Loading...', className = '' }) {
  return (
    <div className={`loading-state ${className}`.trim()} role="status" aria-live="polite">
      <LoaderCircle size={24} className="loading-state-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
