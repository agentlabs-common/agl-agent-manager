"""Generate the public product pitch artwork with Google's Nano Banana Pro API."""
import base64
import json
import os
from pathlib import Path
import shlex
import urllib.error
import urllib.request


def api_key():
    key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if key:
        return key
    source = Path(os.environ.get('CLAUDE_AGENTS_KEYS', Path.home() / '.config/agentlabs/keys.env'))
    if source.exists():
        for line in source.read_text().splitlines():
            line = line.removeprefix('export ').strip()
            if '=' not in line or line.startswith('#'):
                continue
            name, value = line.split('=', 1)
            if name.strip() in ('GEMINI_API_KEY', 'GOOGLE_API_KEY'):
                parts = shlex.split(value)
                if parts:
                    return parts[0]
    raise RuntimeError('Configure a Google AI Studio key locally before generating artwork.')


PROMPT = '''Create a sophisticated, premium software advertising hero image for AGL Agent Manager, a VS Code extension for coordinating Claude Code, Codex and Kimi coding agents. Landscape 16:9 composition. This is conceptual promotional artwork, NOT a fabricated product screenshot.

Art direction: bold editorial typography meets a precision-engineered developer command center. Deep midnight navy background with subtle violet depth and restrained electric cyan, emerald and warm coral accents. Crisp luminous lines link three elegant abstract agent modules to one central editor-like command-center object on the right half. Layered architectural glass panels, dimensional geometry, excellent spacing, subtle material grain. A polished professional developer-tools campaign, not childish robots or generic AI brains. No people, no hands, no banana fruit, no stock imagery, no third-party logos, no tiny fake code, no fake metrics or productivity promises.

The left half has generous negative space and beautifully set, extremely legible sans-serif typography. Render exactly this text, preserving spelling:
Small brand line: "AGL AGENT MANAGER"
Very large two-line headline: "Your agents.\nOne command center."
Supporting line: "Claude Code · Codex · Kimi"
Small feature line: "Teams. Isolated worktrees. Clear status."
Small bottom call to action: "Built for VS Code"

Make the hierarchy instantly readable at thumbnail size. White headline, muted pale-blue supporting text. Use a tasteful emerald highlight on "One command center." Rich contrast, restrained glow, straight typography rather than perspective text, premium launch-ad finish. No extra text, no version number, no watermarks added by the design.'''


FEATURE_PROMPT = """Design a polished 16:9 developer-software advertising feature poster for AGL Agent Manager. This is conceptual promotional artwork, not a product screenshot. Match a premium midnight-navy, violet and emerald campaign with warm coral and electric-cyan accent details. Clean modern sans-serif typography, perfectly aligned 4-column by 3-row feature grid, restrained luminous line icons, generous consistent padding and excellent contrast. No people, no robots, no provider logos, no fake metrics, no bananas. The typography and exact feature labels are the focus. Make every word readable at 2K.

Top brand line: "AGL AGENT MANAGER"
Large headline: "Your whole AI workflow. One place."
Supporting line: "Claude Code · Codex · Kimi"

Exactly these twelve feature cards, left to right, top to bottom, each with its title and one supporting line:
1. "Multiple providers" / "Claude Code, Codex and Kimi"
2. "Teams and status" / "Working, Idle, Stopped, Ephemeral"
3. "Isolated worktrees" / "An agent folder and branch per task"
4. "Native terminals" / "Open the real agent CLI"
5. "Agent portal" / "Status, facts and proposals"
6. "Review and approve" / "Questions, comments and decisions"
7. "Permissioned messaging" / "Agents connect with your approval"
8. "Gemini Live" / "Speak naturally to your agent"
9. "Dictation and readout" / "Dictate prompts. Hear replies."
10. "Skills management" / "Manage reusable agent instructions"
11. "Session controls" / "Resume, stop, hide, delete, YOLO"
12. "Remote SSH" / "Claude and Codex on remote hosts"

Bottom small, legible note: "Linux, macOS and Windows · Voice is Linux-only · Kimi live-state detection requires Linux"
Bottom CTA: "Built for VS Code"

No additional claims. Keep the layout editorial and exceptionally tidy. Text must be verbatim and correctly spelled. No version numbers. Do not imply Kimi SSH or voice on Windows. High-quality launch-campaign finish, simple meaningful icons, subtle materials and depth, no excessive glow."""


def generate(features=False):
    model = 'gemini-3-pro-image'
    payload = {'contents': [{'parts': [{'text': FEATURE_PROMPT if features else PROMPT}]}],
               'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'],
                                    'imageConfig': {'aspectRatio': '16:9', 'imageSize': '2K'}}}
    request = urllib.request.Request(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': api_key()})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Google image generation returned HTTP ' + str(error.code)) from None
    for candidate in result.get('candidates', []):
        for part in candidate.get('content', {}).get('parts', []):
            image = part.get('inlineData') or part.get('inline_data')
            if image and image.get('mimeType', image.get('mime_type', '')).startswith('image/'):
                destination = Path(__file__).resolve().parents[1] / 'media' / ('pitch-features.png' if features else 'pitch-hero.png')
                destination.write_bytes(base64.b64decode(image['data']))
                print('Generated product pitch image with ' + model + ': ' + str(destination))
                return
    raise RuntimeError('Google returned no image; no asset was written.')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--features", action="store_true")
    generate(parser.parse_args().features)
