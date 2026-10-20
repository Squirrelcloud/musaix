import { cn } from "@/lib/utils";

type Avatar = { name: string; image: string | null };

/** Overlapping avatars with a +N overflow chip (after Supabase UI's AvatarStack). */
export function AvatarStack({
  avatars,
  max = 3,
  className,
}: {
  avatars: Avatar[];
  max?: number;
  className?: string;
}) {
  const shown = avatars.slice(0, max);
  const hidden = avatars.slice(max);

  return (
    <ul className={cn("flex -space-x-2", className)}>
      {shown.map((avatar, index) => (
        <li key={`${avatar.name}-${index}`} title={avatar.name}>
          <AvatarCircle avatar={avatar} />
        </li>
      ))}
      {hidden.length > 0 && (
        <li title={hidden.map((avatar) => avatar.name).join(", ")}>
          <span className={circle}>+{hidden.length}</span>
        </li>
      )}
    </ul>
  );
}

const circle =
  "grid size-8 place-items-center overflow-hidden rounded-full bg-bg-subtle text-2xs font-semibold text-fg ring-2 ring-bg";

function AvatarCircle({ avatar }: { avatar: Avatar }) {
  if (avatar.image) {
    return <img src={avatar.image} alt={avatar.name} className={cn(circle, "object-cover")} />;
  }
  return (
    <span className={circle} aria-label={avatar.name}>
      {initials(avatar.name)}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
