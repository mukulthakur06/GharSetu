import React, { useState } from 'react';
import { Check, MessageSquareHeart, X } from 'lucide-react';
import {
  FEEDBACK_REASON_OPTIONS,
  type LanguageMode,
  type PropertyListing,
} from '../types/rental';
import { formatINR } from '../lib/geo';

interface ExitFeedbackModalProps {
  property: PropertyListing;
  language: LanguageMode;
  onSubmit: (payload: {
    reasons: string[];
    comment: string;
    suggestedRent: number;
  }) => Promise<void>;
  onSkip: () => void;
}

export const ExitFeedbackModal: React.FC<ExitFeedbackModalProps> = ({
  property,
  language,
  onSubmit,
  onSkip,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [suggestedRent, setSuggestedRent] = useState<string>(
    String(Math.max(2000, Math.round((property.monthlyRent * 0.85) / 500) * 500))
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleReason = (id: string) => {
    setSelectedReasons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setErrorMsg(null);
  };

  const showSuggestedRent = selectedReasons.includes('Rent jada hai');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReasons.length === 0) {
      setErrorMsg(
        language === 'hinglish'
          ? 'Kam se kam ek wajah select karein, ya Skip dabayein.'
          : 'Select at least one reason, or click Skip.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onSubmit({
        reasons: selectedReasons,
        comment: comment.trim(),
        suggestedRent: showSuggestedRent ? Number(suggestedRent) || 0 : 0,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to save feedback right now.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onSkip}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
              <MessageSquareHeart className="w-3.5 h-3.5" />
              <span>
                {language === 'hinglish'
                  ? 'Owner ke liye Quick Feedback'
                  : 'Quick Owner Improvement Feedback'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {language === 'hinglish'
                ? 'Is ghar mein kya kami lagi?'
                : 'What was missing in this home?'}
            </h2>
            <p className="text-xs text-slate-500">
              {property.title} ({formatINR(property.monthlyRent)}/mo) —{' '}
              {language === 'hinglish'
                ? 'Aapka feedback owner ko ghar sudharne mein madad karega.'
                : 'Your anonymous input helps the owner improve the home.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip feedback"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Reason Toggle Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FEEDBACK_REASON_OPTIONS.map((opt) => {
              const active = selectedReasons.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleReason(opt.id)}
                  className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                    active
                      ? 'bg-teal-50 border-teal-700 text-teal-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{language === 'hinglish' ? opt.hi : opt.en}</span>
                  {active && <Check className="w-3.5 h-3.5 text-teal-800 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Conditional fair rent suggestion */}
          {showSuggestedRent && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                {language === 'hinglish'
                  ? 'Aapke hisab se sahi rent kitna hona chahiye? (₹ / mahina)'
                  : 'What monthly rent would feel fair? (₹ / month)'}
              </label>
              <input
                type="number"
                min={1000}
                max={500000}
                step={500}
                value={suggestedRent}
                onChange={(e) => setSuggestedRent(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:border-teal-700"
              />
            </div>
          )}

          {/* Optional note */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {language === 'hinglish'
                ? 'Koi aur sujhav owner ke liye? (Optional)'
                : 'Any extra suggestion for the owner? (Optional)'}
            </label>
            <textarea
              rows={2}
              maxLength={400}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                language === 'hinglish'
                  ? 'Jaise: Agar fresh paint ya RO lagwa dein toh ghar best ho jayega...'
                  : 'e.g. Fresh paint or adding wardrobes would make this home ideal...'
              }
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 resize-none"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-700 font-medium">{errorMsg}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            >
              {language === 'hinglish' ? 'Skip Karein' : 'Skip for Now'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {submitting
                ? 'Saving...'
                : language === 'hinglish'
                  ? 'Owner ko Feedback Bhejein'
                  : 'Send Feedback to Owner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
