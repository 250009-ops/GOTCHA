import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import ChapterQuizPage from './ChapterQuizPage';
import DailyPractice from '../components/practice/DailyPractice';

/**
 * /app/practice → "Practice my words" (daily mixed session, no chapter needed).
 * /app/practice?sessionId → a Mashq or chapter session that was already started.
 * /app/practice?contentId&segmentId → chapter quiz opened from the Reader.
 */
export default function PracticePage() {
  const [params] = useSearchParams();
  // Chapter quizzes keep their own full-screen layout, layered over the app shell.
  if (params.get('sessionId') || params.get('segmentId')) {
    return createPortal(
      <div className="fixed inset-0 z-[70] overflow-y-auto bg-g-reader-bg">
        <ChapterQuizPage />
      </div>,
      document.body,
    );
  }
  return <DailyPractice />;
}
