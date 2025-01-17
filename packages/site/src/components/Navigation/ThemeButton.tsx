import { useTheme } from '@myst-theme/providers';
import MoonIcon from '@heroicons/react/24/solid/MoonIcon';
import SunIcon from '@heroicons/react/24/outline/SunIcon';
import classNames from 'classnames';

export function ThemeButton({ className = 'mx-3 h-8 w-8' }: { className?: string }) {
  const { isDark, nextTheme } = useTheme();
  return (
    <button
      className={classNames(
        'theme rounded-full border border-stone-700 dark:border-white hover:bg-neutral-100 border-solid overflow-hidden text-stone-700 dark:text-white hover:text-stone-500 dark:hover:text-neutral-800',
        className,
      )}
      title={`Change theme to ${isDark ? 'light' : 'dark'} mode.`}
      aria-label={`Change theme to ${isDark ? 'light' : 'dark'} mode.`}
      onClick={nextTheme}
    >
      {isDark ? (
        <MoonIcon className="h-full w-full p-0.5" />
      ) : (
        <SunIcon className="h-full w-full p-0.5" />
      )}
    </button>
  );
}
