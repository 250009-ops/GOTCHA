import { useSearchParams } from 'react-router-dom';
import ChapterQuizPage from './ChapterQuizPage';
import DailyPractice from '../components/practice/DailyPractice';

/**
 * /app/practice → "Practice my words" (daily mixed session, no chapter needed).
 * /app/practice?contentId&segmentId → chapter quiz opened from the Reader.
 */
export default function PracticePage() {
  const [params] = useSearchParams();
  if (params.get('segmentId')) return <ChapterQuizPage />;
  return <DailyPractice />;
}
