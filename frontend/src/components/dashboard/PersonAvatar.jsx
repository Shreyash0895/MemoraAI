export default function PersonAvatar({ person, size = "md" }) {
  const photos = person.photos ?? [];
  const shown = photos.find((p) => p.status === "ok") ?? photos[0];
  return (
    <span className={`person-avatar ${size}`}>
      {shown ? (
        <img src={`/api/people/${person.id}/photos/${shown.id}`} alt={`Photo of ${person.name}`} loading="lazy" />
      ) : (
        <span aria-hidden="true">{person.name.trim()[0]?.toUpperCase() || "?"}</span>
      )}
    </span>
  );
}
