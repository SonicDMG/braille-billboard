export const billboardConfig = {
  dwellSeconds: Number(process.env.NEXT_PUBLIC_BILLBOARD_DWELL_SECONDS ?? 15),
  resumeAfterManualSeconds: Number(process.env.NEXT_PUBLIC_BILLBOARD_RESUME_SECONDS ?? 60),
  fontSize: Number(process.env.NEXT_PUBLIC_BILLBOARD_FONT_SIZE ?? 32),
  // Playlist is intentionally empty by default — queries are entered by the user.
  // Add strings here to enable auto-cycle mode (C1).
  playlist: [] as string[],
}
