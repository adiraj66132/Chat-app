import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fadeUp, containerStagger, easeOut } from '../../animations/motion';

interface Props {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  errorRef?: React.Ref<HTMLDivElement>;
  error?: string;
}

export default function AuthCard({
  title,
  subtitle,
  footer,
  children,
  onSubmit,
  errorRef,
  error,
}: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerStagger(0.07)}
        className="w-full max-w-sm"
      >
        <motion.div variants={fadeUp} className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-telegram-blue text-2xl font-bold text-white shadow-lg"
          >
            C
          </motion.div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </motion.div>

        {error && (
          <motion.div
            ref={errorRef}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOut}
            className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </motion.div>
        )}

        <motion.form onSubmit={onSubmit} variants={fadeUp} className="space-y-4">
          {children}
        </motion.form>

        <motion.p
          variants={fadeUp}
          className="mt-6 text-center text-sm text-[var(--text-secondary)]"
        >
          {footer}
        </motion.p>
      </motion.div>
    </div>
  );
}
