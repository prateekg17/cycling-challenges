/**
 * Create a challenge tile without interpreting configuration text as HTML.
 * @param {{slug: string, name: string, description: string, gradient: string[], targetRideCount: number}} challenge
 * @returns {HTMLButtonElement}
 */
export function createChallengeTile(challenge) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'challenge-tile';
    tile.style.background = `linear-gradient(135deg, ${challenge.gradient[0]}, ${challenge.gradient[1]})`;
    tile.dataset.slug = challenge.slug;
    tile.setAttribute('aria-label', `Open ${challenge.name}`);
    tile.innerHTML = `
        <p class="challenge-tile__status">Active</p>
        <h2 class="challenge-tile__name"></h2>
        <p class="challenge-tile__description"></p>
        <div class="challenge-tile__progress">
            <div class="challenge-tile__progress-bar">
                <div class="challenge-tile__progress-fill" style="width:0;"></div>
            </div>
            <span class="challenge-tile__progress-pct"></span>
        </div>
    `;
    tile.querySelector('.challenge-tile__name').textContent = challenge.name;
    tile.querySelector('.challenge-tile__description').textContent = challenge.description;
    tile.querySelector('.challenge-tile__progress-pct').textContent = `0 / ${challenge.targetRideCount} rides`;
    return tile;
}
