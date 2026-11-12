/** Appens ägare = första adressen i ALLOWED_EMAIL (får t.ex. obegränsad coach och reservnyckeln till klockan). */
export function isOwner(email?: string | null) {
  const owner = process.env.ALLOWED_EMAIL?.split(",")[0]?.trim().toLowerCase();
  return !!email && !!owner && email.toLowerCase() === owner;
}
