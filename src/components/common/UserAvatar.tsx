import type { AppUser } from '../../types/auth';

export interface UserAvatarProps {
  user?: Pick<
    AppUser,
    'displayName' | 'photoURL' | 'email'
  > | null;
  displayName?: string;
  photoURL?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
  nameClassName?: string;
}

const sizeStyles = {
  xs: {
    container: 'h-7 w-7',
    text: 'text-[10px]',
    name: 'text-xs',
  },
  sm: {
    container: 'h-9 w-9',
    text: 'text-xs',
    name: 'text-sm',
  },
  md: {
    container: 'h-11 w-11',
    text: 'text-sm',
    name: 'text-sm',
  },
  lg: {
    container: 'h-14 w-14',
    text: 'text-base',
    name: 'text-base',
  },
  xl: {
    container: 'h-20 w-20',
    text: 'text-xl',
    name: 'text-lg',
  },
};

function getInitials(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    return 'EA';
  }
  const parts = normalized
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

export default function UserAvatar({
  user,
  displayName,
  photoURL,
  size = 'md',
  className = '',
  showName = false,
  nameClassName = '',
}: UserAvatarProps) {
  const resolvedName =
    user?.displayName ||
    displayName ||
    user?.email ||
    'Utilisateur Ets AMANI';

  const resolvedPhoto =
    user?.photoURL ||
    photoURL ||
    null;

  const styles = sizeStyles[size];

  const avatar = (
    <div
      className={[
        'relative shrink-0 overflow-hidden rounded-full',
        'bg-slate-900 text-white',
        'ring-2 ring-white shadow-sm',
        styles.container,
        className,
      ].join(' ')}
      title={resolvedName}
    >
      {resolvedPhoto ? (
        <img
          src={resolvedPhoto}
          alt={`Photo de profil de ${resolvedName}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-bold">
          <span className={styles.text}>
            {getInitials(resolvedName)}
          </span>
        </div>
      )}
    </div>
  );

  if (!showName) {
    return avatar;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <span
        className={[
          'min-w-0 truncate font-semibold text-slate-900',
          styles.name,
          nameClassName,
        ].join(' ')}
      >
        {resolvedName}
      </span>
    </div>
  );
}
