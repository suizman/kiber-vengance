export const trackIds = ['lead', 'guitar', 'bass', 'pad', 'drums'];
export function isProject(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return candidate.version === 5 && typeof candidate.title === 'string' && Array.isArray(candidate.clips) &&
        Array.isArray(candidate.arrangement) && trackIds.every(track => typeof candidate.activeClipIds?.[track] === 'string');
}
