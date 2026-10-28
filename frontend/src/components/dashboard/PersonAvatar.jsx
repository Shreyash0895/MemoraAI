export default function PersonAvatar({ person, size = "md" }) {
  const first = person.photos?.[0];
  return (
    <span className={`person-avatar ${size}`}>
      {first ? (
        <img src={`/api/people/${person.id}/photos/${first}`} alt={`Photo of ${person.name}`} loading="lazy" />
      ) : (
        <span aria-hidden="true">{person.name.trim()[0]?.toUpperCase() || "?"}</span>
      )}
    </span>
  );
}
